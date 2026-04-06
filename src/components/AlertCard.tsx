import { Alert } from "@/data/mock-data";
import { AlertTriangle, CheckCircle, Info, AlertOctagon, Check, X, Trash2 } from "lucide-react";

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

interface AlertCardProps {
  alert: Alert & { isRead?: boolean };
  onMarkRead?: () => void;
  onDismiss?: () => void;
  onDelete?: () => void;
}

export function AlertCard({ alert, onMarkRead, onDismiss, onDelete }: AlertCardProps) {
  const Icon = iconMap[alert.type];
  const isRead = (alert as any).isRead ?? alert.read;

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${styleMap[alert.type]} ${
        isRead ? "opacity-70" : ""
      }`}
    >
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[alert.type]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            {!isRead && (
              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">{alert.time}</p>
            <div className="flex items-center gap-1">
              {onMarkRead && !isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  <Check className="h-3 w-3" /> Read
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-2"
                >
                  <X className="h-3 w-3" /> Dismiss
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 ml-2"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
