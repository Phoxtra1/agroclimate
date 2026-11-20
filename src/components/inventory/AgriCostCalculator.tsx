import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Package, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { InventoryItem, LaborRecord, LandCost, HarvestRecord, SalesRecord } from "@/hooks/useInventory";

interface Scenario {
  id?: string;
  scenario_title: string;
  crop_name: string;
  land_prep_cost: number;
  seed_cost: number;
  fertilizer_cost: number;
  other_input_cost: number;
  labor_cost: number;
  irrigation_cost: number;
  transport_cost: number;
  harvest_cost: number;
  storage_cost: number;
  estimated_yield_units: number;
  unit: string;
  market_price_per_unit: number;
  currency_code: string;
  data_source_type: "user_entered" | "estimated" | "ai_derived";
}

interface AgriCostCalculatorProps {
  currencyCode?: string;
  inventoryItems: InventoryItem[];
  laborRecords: LaborRecord[];
  landCosts: LandCost[];
  harvestRecords: HarvestRecord[];
  salesRecords: SalesRecord[];
  crops: string[];
}

export function AgriCostCalculator({
  currencyCode = "USD",
  inventoryItems,
  laborRecords,
  landCosts,
  harvestRecords,
  salesRecords,
  crops,
}: AgriCostCalculatorProps) {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [savingScenario, setSavingScenario] = useState(false);
  const requestVersion = useRef(0);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;

  const refreshScenarios = useCallback(async () => {
    const userId = user?.id;
    if ((userId ?? null) !== currentUserId.current) return;
    const version = ++requestVersion.current;
    setScenarios([]);
    if (!userId) {
      setScenarioLoading(false);
      return;
    }
    setScenarioLoading(true);
    try {
      const { data, error } = await supabase.from("agri_cost_scenarios" as any)
        .select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (version !== requestVersion.current || userId !== currentUserId.current) return;
      if (error) throw error;
      setScenarios((data || []) as unknown as Scenario[]);
    } catch (error) {
      if (version === requestVersion.current && userId === currentUserId.current) {
        setScenarios([]);
        toast.error("Could not load saved cost scenarios", {
          description: error instanceof Error ? error.message : "Please retry.",
        });
      }
    } finally {
      if (version === requestVersion.current && userId === currentUserId.current) setScenarioLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshScenarios();
    return () => { requestVersion.current += 1; };
  }, [refreshScenarios]);

  const allocateInputs = (crop: string, predicate: (item: InventoryItem) => boolean) => {
    const matching = inventoryItems.filter((item) => predicate(item) && item.crop_name?.toLowerCase() === crop.toLowerCase());
    const unassigned = inventoryItems.filter((item) => predicate(item) && !item.crop_name);
    const specificCost = matching.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0), 0);
    const sharedCost = unassigned.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price_per_unit || 0), 0);
    return specificCost + sharedCost / Math.max(crops.length, 1);
  };

  const allocateLabor = (crop: string) => {
    const matching = laborRecords.filter((record) => record.crop_name?.toLowerCase() === crop.toLowerCase());
    const unassigned = laborRecords.filter((record) => !record.crop_name);
    const cost = (record: LaborRecord) => Number(record.worker_count || 0) * Number(record.days_worked || 0) * Number(record.cost_per_day || 0);
    return matching.reduce((sum, record) => sum + cost(record), 0) +
      unassigned.reduce((sum, record) => sum + cost(record), 0) / Math.max(crops.length, 1);
  };

  // Shared inputs, labour and land costs are allocated evenly across crops where
  // no crop/plot allocation was entered. These figures are estimates, not verified accounts.
  const generatedScenarios: Scenario[] = crops.map((crop) => {
    const cropHarvest = harvestRecords.filter((record) => record.crop_name.toLowerCase() === crop.toLowerCase());
    const cropSales = salesRecords.filter((record) => record.crop_name.toLowerCase() === crop.toLowerCase());
    const seedCost = allocateInputs(crop, (item) =>
      item.item_type.toLowerCase().includes("seed") || item.item_type.toLowerCase().includes("stock"));
    const fertilizerCost = allocateInputs(crop, (item) =>
      item.item_type.toLowerCase().includes("fert") || item.item_type.toLowerCase().includes("chem"));
    const otherInputCost = allocateInputs(crop, (item) =>
      !item.item_type.toLowerCase().includes("seed") &&
      !item.item_type.toLowerCase().includes("stock") &&
      !item.item_type.toLowerCase().includes("fert") &&
      !item.item_type.toLowerCase().includes("chem"));
    const laborCost = allocateLabor(crop);
    const landCost = landCosts.reduce((sum, record) => sum + Number(record.cost_amount || 0), 0) / Math.max(crops.length, 1);
    const unit = cropHarvest[0]?.unit || cropSales[0]?.unit || "kg";
    // Never add kilograms to bags/crates or derive a price from sales in another unit.
    const sameUnitHarvest = cropHarvest.filter((record) => record.unit === unit);
    const sameUnitSales = cropSales.filter((record) => record.unit === unit);
    const totalYield = sameUnitHarvest.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    const soldQuantity = sameUnitSales.reduce((sum, record) => sum + Number(record.quantity_sold || 0), 0);
    const salesValue = sameUnitSales.reduce((sum, record) =>
      sum + Number(record.quantity_sold || 0) * Number(record.price_per_unit || 0), 0);
    const weightedPrice = soldQuantity > 0 ? salesValue / soldQuantity : 0;

    return {
      scenario_title: `Calculated estimate: ${crop} (${unit})`,
      crop_name: crop,
      land_prep_cost: landCost,
      seed_cost: seedCost,
      fertilizer_cost: fertilizerCost,
      other_input_cost: otherInputCost,
      labor_cost: laborCost,
      irrigation_cost: 0,
      transport_cost: 0,
      harvest_cost: 0,
      storage_cost: 0,
      estimated_yield_units: totalYield,
      unit,
      market_price_per_unit: weightedPrice,
      currency_code: currencyCode,
      data_source_type: "estimated",
    };
  });

  const activeScenarios = [...scenarios, ...generatedScenarios];

  const calculateScenario = (scenario: Scenario) => {
    const totalCost =
      Number(scenario.land_prep_cost || 0) +
      Number(scenario.seed_cost || 0) +
      Number(scenario.fertilizer_cost || 0) +
      Number(scenario.other_input_cost || 0) +
      Number(scenario.labor_cost || 0) +
      Number(scenario.irrigation_cost || 0) +
      Number(scenario.transport_cost || 0) +
      Number(scenario.harvest_cost || 0) +
      Number(scenario.storage_cost || 0);
    const revenue = Number(scenario.estimated_yield_units || 0) * Number(scenario.market_price_per_unit || 0);
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { totalCost, revenue, margin, marginPct };
  };

  const saveScenarioToDb = async (scenario: Scenario) => {
    if (!user?.id || user.id !== currentUserId.current) {
      toast.error("Sign in to save a cost scenario.");
      return;
    }
    setSavingScenario(true);
    try {
      const payload = { ...scenario };
      delete payload.id;
      const { error } = await supabase.from("agri_cost_scenarios" as any).insert({
        ...payload,
        user_id: user.id,
        currency_code: currencyCode,
        data_source_type: scenario.data_source_type === "ai_derived" ? "ai_derived" : "estimated",
      });
      if (error) throw error;
      toast.success("Cost scenario saved");
      await refreshScenarios();
    } catch (error) {
      toast.error("Could not save cost scenario", {
        description: error instanceof Error ? error.message : "Please retry.",
      });
    } finally {
      setSavingScenario(false);
    }
  };

  const deleteScenario = async (id: string) => {
    if (!user?.id || user.id !== currentUserId.current) return;
    const { data, error } = await supabase.from("agri_cost_scenarios" as any)
      .delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) {
      toast.error("Could not delete saved scenario", {
        description: error?.message || "Scenario not found or access denied.",
      });
      return;
    }
    toast.success("Saved scenario deleted");
    await refreshScenarios();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Agricultural Cost &amp; Profitability Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Estimates use entered farm records. Shared costs are allocated evenly where no crop allocation is recorded; this is not audited accounting.
          </p>
        </div>
      </div>

      {scenarioLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved scenarios…</div>}

      {crops.length === 0 && scenarios.length === 0 && !scenarioLoading && (
        <Card className="border border-dashed p-6 text-center text-xs text-muted-foreground space-y-2">
          <Package className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="font-semibold text-foreground">No inventory records found for cost calculation.</p>
          <p>Add inputs, labour, land costs, harvest and sales records in the tabs to calculate crop costs and profitability estimates.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeScenarios.map((scenario, index) => {
          const calc = calculateScenario(scenario);
          const displayCurrency = scenario.currency_code || currencyCode;
          return (
            <Card key={scenario.id || `${scenario.crop_name}-${scenario.scenario_title}-${index}`} className="border border-border/70 hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold">{scenario.scenario_title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{scenario.crop_name} · {scenario.estimated_yield_units} {scenario.unit}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{scenario.data_source_type.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg font-mono">
                  <div className="flex justify-between"><span>Land Cost:</span><span>{displayCurrency} {scenario.land_prep_cost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Seeds / Stock:</span><span>{displayCurrency} {scenario.seed_cost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Fertilizer / Chemicals:</span><span>{displayCurrency} {scenario.fertilizer_cost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Other Inputs:</span><span>{displayCurrency} {scenario.other_input_cost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Labour:</span><span>{displayCurrency} {scenario.labor_cost.toLocaleString()}</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold text-foreground">
                    <span>Total Production Cost:</span><span>{displayCurrency} {calc.totalCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-emerald-50 text-emerald-900 p-2 rounded-md">
                    <p className="text-[10px] text-emerald-700 font-semibold uppercase">Estimated Revenue</p>
                    <p className="text-sm font-bold">{displayCurrency} {calc.revenue.toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded-md ${calc.margin >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    <p className="text-[10px] font-semibold uppercase">Estimated Net Margin</p>
                    <p className="text-sm font-bold">{displayCurrency} {calc.margin.toLocaleString()} ({calc.marginPct.toFixed(1)}%)</p>
                  </div>
                </div>

                {scenario.id ? (
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => void deleteScenario(scenario.id!)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete saved scenario
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => void saveScenarioToDb(scenario)} disabled={savingScenario || scenarioLoading}>
                    {savingScenario ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save Scenario Record
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
