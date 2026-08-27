import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useNewTag } from "@/hooks/useNewTag";
import {
  TrendingUp, DollarSign, ShieldCheck, ChevronDown, ChevronUp,
  Users, Package, BarChart3, Warehouse, LineChart, Bot, Sprout,
  AlertTriangle, Lightbulb, ArrowRight
} from "lucide-react";
import { InvestmentEvaluatorPanel } from "@/components/investment/InvestmentEvaluatorPanel";

interface Solution {
  id: string;
  question: string;
  icon: React.ElementType;
  color: string;
  pillars: {
    title: string;
    icon: React.ElementType;
    actions: { step: string; detail: string; tool?: string }[];
  }[];
}

const solutions: Solution[] = [
  {
    id: "profitability",
    question: "If farming is profitable, why are most farmers still poor?",
    icon: DollarSign,
    color: "text-amber-600",
    pillars: [
      {
        title: "Track Every Cost",
        icon: BarChart3,
        actions: [
          { step: "Record all inputs, labor, land, and transport costs", detail: "Most farmers underestimate costs by 40–60%. Hidden costs include transport, storage losses, and middlemen fees.", tool: "Agro Inventory" },
          { step: "Calculate true cost per kilogram of produce", detail: "Divide total season cost by total harvest quantity. This is your break-even price — never sell below it." },
          { step: "Identify your top 3 expense categories", detail: "Usually: inputs (seeds, fertilizer), labor, and post-harvest losses. Reducing any by 20% significantly impacts profit." },
        ],
      },
      {
        title: "Reduce Post-Harvest Losses",
        icon: Warehouse,
        actions: [
          { step: "Invest in improved storage (hermetic bags, metal silos)", detail: "PICS bags cost $2–3 each but save 30% of grain typically lost to weevils. One bag pays for itself in one season." },
          { step: "Harvest at correct maturity and moisture", detail: "Maize: harvest at 20–25% moisture, dry to 13% before storage. Tomatoes: harvest at breaker stage for transport." },
          { step: "Process raw produce into value-added products", detail: "Cassava → gari/flour (3× value), tomatoes → paste (5× value), groundnuts → oil/paste (2× value). Processing extends shelf life and multiplies income." },
        ],
      },
      {
        title: "Join or Form a Cooperative",
        icon: Users,
        actions: [
          { step: "Bulk-buy inputs together for 20–40% savings", detail: "A group of 20 farmers buying 100 bags of fertilizer negotiates far better than one farmer buying 5 bags." },
          { step: "Share equipment and infrastructure costs", detail: "Tractor hire, irrigation pumps, drying platforms, and storage facilities become affordable when shared." },
          { step: "Access credit and training as a group", detail: "Banks and NGOs prefer lending to organized groups. Savings and loan schemes within cooperatives build capital." },
        ],
      },
    ],
  },
  {
    id: "pricing",
    question: "Why do farmers beg buyers instead of setting prices?",
    icon: TrendingUp,
    color: "text-emerald-600",
    pillars: [
      {
        title: "Know Your Market",
        icon: LineChart,
        actions: [
          { step: "Check prices in 3+ markets before selling", detail: "Price differences of 30–100% exist between farmgate, local market, and urban market. Information is power." },
          { step: "Track seasonal price patterns", detail: "Prices are lowest at harvest time (everyone sells). Store for 2–3 months to sell at 40–80% higher off-season prices." },
          { step: "Identify premium buyers (restaurants, hotels, exporters)", detail: "Direct-to-buyer relationships eliminate 2–3 middlemen, each taking 15–25% margin." },
        ],
      },
      {
        title: "Store Strategically",
        icon: Warehouse,
        actions: [
          { step: "Build or access community storage facilities", detail: "Warehouse receipt systems let you store grain and get a receipt to borrow against while waiting for better prices." },
          { step: "Sell in stages, not all at once", detail: "Sell 30% at harvest for immediate needs, 30% after 2 months, 40% at peak price period. This averages out risk." },
          { step: "Use cold storage for perishables", detail: "Solar-powered cold rooms for vegetables and fruits extend shelf life from days to weeks, eliminating desperation selling." },
        ],
      },
      {
        title: "Negotiate from Strength",
        icon: Users,
        actions: [
          { step: "Grade and sort produce by quality", detail: "Grade A produce commands 30–50% premium. Sort by size, color, and condition. Package attractively." },
          { step: "Sell collectively through cooperatives", detail: "100 farmers selling 100 tonnes together have far more negotiating power than 1 farmer selling 1 tonne." },
          { step: "Use contract farming and forward agreements", detail: "Agree on price BEFORE planting. Companies like OLAM, Cargill, and local aggregators offer guaranteed purchase contracts." },
        ],
      },
    ],
  },
  {
    id: "resilience",
    question: "Why does one bad season destroy a farmer completely?",
    icon: ShieldCheck,
    color: "text-blue-600",
    pillars: [
      {
        title: "Diversify Your Enterprise",
        icon: Sprout,
        actions: [
          { step: "Never depend on a single crop", detail: "Grow 2–3 crops across different risk profiles: one drought-tolerant, one high-value, one staple food." },
          { step: "Add livestock or aquaculture", detail: "Poultry generates income in 6–8 weeks, goats in 6 months. Fish ponds produce protein and income year-round." },
          { step: "Include off-season income activities", detail: "Dry-season vegetable gardening, value-added processing, or livestock fattening keeps income flowing year-round." },
        ],
      },
      {
        title: "Build Financial Resilience",
        icon: DollarSign,
        actions: [
          { step: "Save 10–20% of each season's revenue", detail: "Village Savings and Loan Associations (VSLAs) or mobile money savings. Target 3 months of operating costs as emergency reserve." },
          { step: "Explore crop insurance options", detail: "Weather-based index insurance is available in many African countries. Premiums are 5–10% of insured value. Some are government-subsidized." },
          { step: "Use mobile money for financial tracking", detail: "Digital financial records help access credit. Regular savings patterns build creditworthiness for agricultural loans." },
        ],
      },
      {
        title: "Use Climate-Smart Practices",
        icon: AlertTriangle,
        actions: [
          { step: "Plant drought and flood-resistant varieties", detail: "WITA-4 rice for floods, SAMMAZ maize for drought. Improved varieties cost slightly more but survive extreme weather." },
          { step: "Harvest rainwater and practice water conservation", detail: "Simple earth dams, rooftop harvesting, and mulching can provide supplementary irrigation during dry spells." },
          { step: "Build seed banks and feed reserves", detail: "Store enough seed for next season plus 50% extra. Store 2–3 months of animal feed. This eliminates the panic of starting from zero." },
        ],
      },
    ],
  },
];

export default function FarmBusinessHub() {
  const [expandedSolution, setExpandedSolution] = useState<string | null>(solutions[0].id);
  const [expandedPillar, setExpandedPillar] = useState<Record<string, number | null>>({});
  const { isNew, markVisited } = useNewTag();
  const [showNewBadge, setShowNewBadge] = useState(() => isNew("farm-business-hub"));

  useEffect(() => {
    markVisited("farm-business-hub");
  }, [markVisited]);

  const togglePillar = (solutionId: string, index: number) => {
    setExpandedPillar(prev => ({
      ...prev,
      [solutionId]: prev[solutionId] === index ? null : index,
    }));
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Farm Business Hub</h1>
          {showNewBadge && <Badge variant="default" className="text-[10px]">New</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Practical, actionable solutions to the real challenges facing African farmers. No theories — just steps you can take today.
        </p>
      </div>

      <div className="space-y-4">
        {solutions.map((solution) => {
          const isExpanded = expandedSolution === solution.id;
          const SolutionIcon = solution.icon;

          return (
            <Card key={solution.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedSolution(isExpanded ? null : solution.id)}
                className="w-full text-left"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 ${solution.color}`}>
                        <SolutionIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm leading-snug">{solution.question}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{solution.pillars.length} strategic solutions</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {solution.pillars.map((pillar, pIdx) => {
                    const PillarIcon = pillar.icon;
                    const isPillarExpanded = expandedPillar[solution.id] === pIdx;

                    return (
                      <div key={pIdx} className="border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => togglePillar(solution.id, pIdx)}
                          className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <PillarIcon className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{pillar.title}</span>
                          </div>
                          {isPillarExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>

                        {isPillarExpanded && (
                          <div className="p-3 space-y-3">
                            {pillar.actions.map((action, aIdx) => (
                              <div key={aIdx} className="flex gap-3">
                                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                  {aIdx + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{action.step}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{action.detail}</p>
                                  {action.tool && (
                                    <Link to={action.tool === "Agro Inventory" ? "/inventory" : "/dipa"}>
                                      <Badge variant="outline" className="mt-1.5 text-[10px] cursor-pointer hover:bg-primary/10">
                                        <Package className="h-3 w-3 mr-1" /> Use {action.tool} <ArrowRight className="h-3 w-3 ml-1" />
                                      </Badge>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Investment Evaluator Section */}
      <div className="mt-8 pt-6 border-t">
        <InvestmentEvaluatorPanel />
      </div>

      {/* Dipa CTA */}
      <Card className="mt-6 border-dashed border-primary/40 bg-primary/5">
        <CardContent className="pt-4 flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Need personalized business advice?</p>
            <p className="text-xs text-muted-foreground">Ask Dipa for strategies tailored to your crops, location, and season.</p>
          </div>
          <Link to="/dipa">
            <Button size="sm">Ask Dipa</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
