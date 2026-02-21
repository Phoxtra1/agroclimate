import { CropAdvisory } from "@/hooks/useCropAdvisory";
import { Sprout, AlertTriangle, CheckCircle, Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <p className="text-sm text-muted-foreground mt-2">Generating AI crop advisory…</p>
      </div>
    );
  }

  if (!advisory) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-sm text-center">
        <Sprout className="h-8 w-8 mx-auto text-primary/40" />
        <p className="text-sm text-muted-foreground mt-2">Get AI-powered crop recommendations based on your local weather</p>
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
              <div>
                <p className="font-semibold text-sm">{crop.name}</p>
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
