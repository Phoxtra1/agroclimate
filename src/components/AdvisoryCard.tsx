import { Lightbulb } from "lucide-react";

interface AdvisoryProps {
  crop: string;
  region: string;
  action: string;
  detail: string;
  urgency: "high" | "medium" | "low";
}

const urgencyStyle = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-primary",
};

const urgencyLabel = {
  high: "Act Now",
  medium: "This Week",
  low: "Coming Up",
};

export function AdvisoryCard({ crop, region, action, detail, urgency }: AdvisoryProps) {
  return (
    <div className={`rounded-xl bg-card p-5 border-l-4 shadow-sm ${urgencyStyle[urgency]}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm">Today's Advice</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold">
              {urgencyLabel[urgency]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {crop} · {region}
          </p>
          <p className="font-semibold mt-2">{action}</p>
          <p className="text-sm text-muted-foreground mt-1">{detail}</p>
        </div>
      </div>
    </div>
  );
}
