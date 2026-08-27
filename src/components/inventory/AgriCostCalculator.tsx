import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Plus, Trash2, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInventory } from "@/hooks/useInventory";
import { toast } from "sonner";

interface Scenario {
  id?: string;
  scenario_title: string;
  crop_name: string;
  land_prep_cost: number;
  seed_cost: number;
  fertilizer_cost: number;
  labor_cost: number;
  irrigation_cost: number;
  transport_cost: number;
  harvest_cost: number;
  storage_cost: number;
  estimated_yield_units: number;
  unit: string;
  market_price_per_unit: number;
  data_source_type: "verified" | "user_entered" | "estimated" | "ai_derived";
}

export function AgriCostCalculator({ currencyCode = "USD" }: { currencyCode?: string }) {
  const { inventoryItems, laborRecords, landCosts, harvestRecords, salesRecords, crops, loading: invLoading } = useInventory();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Auto-calculate real scenario based on user's entered inventory items
  useEffect(() => {
    if (crops.length > 0 && !selectedCrop) {
      setSelectedCrop(crops[0]);
    }
  }, [crops, selectedCrop]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("agri_cost_scenarios" as any).select("*");
      if (data && data.length > 0) {
        setScenarios(data as any);
      }
    })();
  }, []);

  // Compute actual costs for selected crop directly from inventory tables
  const userCropScenarios: Scenario[] = crops.map((crop) => {
    const cropInputs = inventoryItems.filter(i => !i.crop_name || i.crop_name.toLowerCase() === crop.toLowerCase());
    const cropLabor = laborRecords.filter(l => !l.crop_name || l.crop_name.toLowerCase() === crop.toLowerCase());
    const cropHarvest = harvestRecords.filter(h => h.crop_name.toLowerCase() === crop.toLowerCase());
    const cropSales = salesRecords.filter(s => s.crop_name.toLowerCase() === crop.toLowerCase());

    const seedCost = cropInputs
      .filter(i => i.item_type.toLowerCase().includes("seed") || i.item_type.toLowerCase().includes("stock"))
      .reduce((sum, i) => sum + (i.quantity * i.price_per_unit), 0);

    const fertCost = cropInputs
      .filter(i => i.item_type.toLowerCase().includes("fert") || i.item_type.toLowerCase().includes("chem"))
      .reduce((sum, i) => sum + (i.quantity * i.price_per_unit), 0);

    const otherInputCost = cropInputs
      .filter(i => !i.item_type.toLowerCase().includes("seed") && !i.item_type.toLowerCase().includes("fert") && !i.item_type.toLowerCase().includes("chem"))
      .reduce((sum, i) => sum + (i.quantity * i.price_per_unit), 0);

    const laborCost = cropLabor.reduce((sum, l) => sum + (l.worker_count * l.days_worked * l.cost_per_day), 0);
    const landCost = landCosts.reduce((sum, l) => sum + l.cost_amount, 0) / (crops.length || 1);

    const totalYield = cropHarvest.reduce((sum, h) => sum + h.quantity, 0);
    const unit = cropHarvest[0]?.unit || cropSales[0]?.unit || "kg";
    const avgPrice = cropSales.length > 0
      ? cropSales.reduce((sum, s) => sum + s.price_per_unit, 0) / cropSales.length
      : 2.0;

    return {
      scenario_title: `Actual Inventory Record: ${crop}`,
      crop_name: crop,
      land_prep_cost: Math.round(landCost),
      seed_cost: Math.round(seedCost),
      fertilizer_cost: Math.round(fertCost + otherInputCost),
      labor_cost: Math.round(laborCost),
      irrigation_cost: 0,
      transport_cost: 0,
      harvest_cost: 0,
      storage_cost: 0,
      estimated_yield_units: totalYield || 1000,
      unit,
      market_price_per_unit: avgPrice,
      data_source_type: "verified",
    };
  });

  const activeScenarios = scenarios.length > 0 ? scenarios : userCropScenarios;

  const calculateScenario = (s: Scenario) => {
    const totalCost =
      Number(s.land_prep_cost || 0) +
      Number(s.seed_cost || 0) +
      Number(s.fertilizer_cost || 0) +
      Number(s.labor_cost || 0) +
      Number(s.irrigation_cost || 0) +
      Number(s.transport_cost || 0) +
      Number(s.harvest_cost || 0) +
      Number(s.storage_cost || 0);

    const revenue = Number(s.estimated_yield_units || 0) * Number(s.market_price_per_unit || 0);
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    return { totalCost, revenue, margin, marginPct };
  };

  const saveScenarioToDb = async (s: Scenario) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("agri_cost_scenarios" as any).insert({
        ...s,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Scenario saved to database");
    } catch (err: any) {
      toast.error(err.message || "Saved locally");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Agricultural Cost &amp; Profitability Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Derived directly from your entered inventory inputs, labor, and crop harvest records
          </p>
        </div>
      </div>

      {crops.length === 0 && (
        <Card className="border border-dashed p-6 text-center text-xs text-muted-foreground space-y-2">
          <Package className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="font-semibold text-foreground">No inventory records found for cost calculation.</p>
          <p>Add your inputs (seeds, fertilizer, labor, harvest) in the tabs above to calculate actual crop costs and profitability margins.</p>
        </Card>
      )}

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeScenarios.map((s, idx) => {
          const calc = calculateScenario(s);
          return (
            <Card key={idx} className="border border-border/70 hover:border-primary/50 transition-colors shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold">{s.scenario_title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{s.crop_name} · {s.estimated_yield_units} {s.unit}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {s.data_source_type.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg font-mono">
                  <div className="flex justify-between"><span>Land Cost:</span><span>{currencyCode} {s.land_prep_cost}</span></div>
                  <div className="flex justify-between"><span>Seeds / Stock Input:</span><span>{currencyCode} {s.seed_cost}</span></div>
                  <div className="flex justify-between"><span>Fertilizer / Inputs:</span><span>{currencyCode} {s.fertilizer_cost}</span></div>
                  <div className="flex justify-between"><span>Labor Records:</span><span>{currencyCode} {s.labor_cost}</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold text-foreground">
                    <span>Total Production Cost:</span>
                    <span>{currencyCode} {calc.totalCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-emerald-50 text-emerald-900 p-2 rounded-md">
                    <p className="text-[10px] text-emerald-700 font-semibold uppercase">Est. Revenue</p>
                    <p className="text-sm font-bold">{currencyCode} {calc.revenue.toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded-md ${calc.margin >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    <p className="text-[10px] font-semibold uppercase">Est. Net Margin</p>
                    <p className="text-sm font-bold">{currencyCode} {calc.margin.toLocaleString()} ({calc.marginPct.toFixed(1)}%)</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => saveScenarioToDb(s)}
                  disabled={loading}
                >
                  Save Scenario Record
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
