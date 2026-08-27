import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ArrowRightLeft, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    scenario_title: "Plant Maize Now (Optimal Window)",
    crop_name: "Maize",
    land_prep_cost: 450,
    seed_cost: 300,
    fertilizer_cost: 650,
    labor_cost: 800,
    irrigation_cost: 200,
    transport_cost: 350,
    harvest_cost: 400,
    storage_cost: 150,
    estimated_yield_units: 3500,
    unit: "kg",
    market_price_per_unit: 1.8,
    data_source_type: "ai_derived",
  },
  {
    scenario_title: "Plant Soybean (Higher Margin)",
    crop_name: "Soybean",
    land_prep_cost: 450,
    seed_cost: 400,
    fertilizer_cost: 400,
    labor_cost: 700,
    irrigation_cost: 150,
    transport_cost: 300,
    harvest_cost: 350,
    storage_cost: 150,
    estimated_yield_units: 2800,
    unit: "kg",
    market_price_per_unit: 2.6,
    data_source_type: "ai_derived",
  },
  {
    scenario_title: "Delay Planting by 2 Weeks",
    crop_name: "Maize",
    land_prep_cost: 450,
    seed_cost: 300,
    fertilizer_cost: 650,
    labor_cost: 850,
    irrigation_cost: 450,
    transport_cost: 380,
    harvest_cost: 400,
    storage_cost: 150,
    estimated_yield_units: 3000,
    unit: "kg",
    market_price_per_unit: 1.85,
    data_source_type: "estimated",
  },
];

export function AgriCostCalculator({ currencyCode = "USD" }: { currencyCode?: string }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("agri_cost_scenarios" as any).select("*");
      if (data && data.length > 0) {
        setScenarios(data as any);
      }
    })();
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Agricultural Cost &amp; Profitability Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Location and time-specific cost estimation &amp; multi-scenario comparison
          </p>
        </div>
      </div>

      {/* Scenario Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((s, idx) => {
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
                  <div className="flex justify-between"><span>Land Prep:</span><span>{currencyCode} {s.land_prep_cost}</span></div>
                  <div className="flex justify-between"><span>Seeds / Stock:</span><span>{currencyCode} {s.seed_cost}</span></div>
                  <div className="flex justify-between"><span>Fertilizer / Inputs:</span><span>{currencyCode} {s.fertilizer_cost}</span></div>
                  <div className="flex justify-between"><span>Labor:</span><span>{currencyCode} {s.labor_cost}</span></div>
                  <div className="flex justify-between"><span>Irrigation &amp; Power:</span><span>{currencyCode} {s.irrigation_cost}</span></div>
                  <div className="flex justify-between"><span>Transport &amp; Storage:</span><span>{currencyCode} {s.transport_cost + s.storage_cost}</span></div>
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
                  Save Scenario
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
