import { Alert } from "@/data/mock-data";
import { AlertTriangle, CheckCircle, Info, AlertOctagon } from "lucide-react";

const iconMap = {
  warning: AlertTriangle,
  danger: AlertOctagon,
  info: Info,
  success: CheckCircle,
};

const styleMap = {
  warning: "border-l-warning bg-warning/5",
  danger: "border-l-destructive bg-destructive/5",
  info: "border-l-accent bg-accent/5",
  success: "border-l-success bg-success/5",
};

const iconColorMap = {
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-accent",
  success: "text-success",
};

export function AlertCard({ alert }: { alert: Alert }) {
  const Icon = iconMap[alert.type];

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${styleMap[alert.type]} ${
        alert.read ? "opacity-70" : ""
      }`}
    >
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[alert.type]}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            {!alert.read && (
              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
          <p className="text-xs text-muted-foreground mt-2">{alert.time}</p>
        </div>
      </div>
    </div>
  );
}
