import { CropAdvisory } from "@/hooks/useCropAdvisory";
import { Sprout, AlertTriangle, CheckCircle, Loader2, Lightbulb, Droplets, Fish } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  advisory: CropAdvisory | null;
  loading: boolean;
  onRefresh: () => void;
}

export function AICropAdvisory({ advisory, loading, onRefresh }: Props) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-sm text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Generating AI advisory…</p>
      </div>
    );
  }

  if (!advisory) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-sm text-center">
        <Sprout className="h-8 w-8 mx-auto text-primary/40" />
        <p className="text-sm text-muted-foreground mt-2">Get AI-powered crop, livestock & fish farming recommendations</p>
        <Button size="sm" className="mt-3" onClick={onRefresh}>
          <Lightbulb className="h-4 w-4 mr-1" /> Get Advisory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recommended Crops */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
          <Sprout className="h-4 w-4 text-primary" /> Recommended Crops
        </h3>
        <div className="space-y-2">
          {advisory.recommendedCrops.map((crop, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-lg">{crop.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{crop.name}</p>
                  {crop.category && <Badge variant="outline" className="text-[9px] py-0">{crop.category}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{crop.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Actions */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4 text-success" /> This Week's Actions
        </h3>
        <ul className="space-y-1.5">
          {advisory.weeklyActions.map((action, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span> {action}
            </li>
          ))}
        </ul>
      </div>

      {/* Irrigation Advice */}
      {advisory.irrigationAdvice && (
        <div className={`rounded-xl p-4 ${advisory.irrigationAdvice.needed ? "bg-warning/10" : "bg-success/10"}`}>
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
            <Droplets className="h-4 w-4 text-accent" /> Irrigation
          </h3>
          <p className="text-xs text-muted-foreground">{advisory.irrigationAdvice.reason}</p>
          {advisory.irrigationAdvice.needed && (
            <p className="text-xs font-medium mt-1">Method: {advisory.irrigationAdvice.method}</p>
          )}
        </div>
      )}

      {/* Livestock Advice */}
      {advisory.livestockAdvice && advisory.livestockAdvice.length > 0 && (
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm mb-3">🐐 Livestock Advisory</h3>
          {advisory.livestockAdvice.map((l, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="text-sm font-medium">{l.animal}</p>
              <p className="text-xs text-muted-foreground">{l.advice}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fish Farming */}
      {advisory.fishFarmingAdvice && (
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
            <Fish className="h-4 w-4 text-accent" /> Fish Farming
          </h3>
          <p className="text-xs text-muted-foreground">{advisory.fishFarmingAdvice}</p>
        </div>
      )}

      {/* Risks */}
      {advisory.risks.length > 0 && (
        <div className="bg-destructive/5 rounded-xl p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Weather Risks
          </h3>
          {advisory.risks.map((r, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="text-sm font-medium">{r.risk}</p>
              <p className="text-xs text-muted-foreground">→ {r.mitigation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="bg-primary/10 rounded-xl p-4">
        <p className="text-sm font-semibold text-primary">💡 AI Tip</p>
        <p className="text-sm text-muted-foreground mt-1">{advisory.tip}</p>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onRefresh}>
        Refresh Advisory
      </Button>
    </div>
  );
}
