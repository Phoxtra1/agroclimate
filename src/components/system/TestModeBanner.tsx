import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTestMode } from "@/hooks/useTestMode";

/** Small inline badge; render only where Test Mode changed behaviour. */
export function TestModeBadge({ label }: { label?: string }) {
  return (
    <Badge variant="secondary" className="gap-1.5 border border-warning/40 bg-warning/10 text-warning-foreground">
      <FlaskConical className="h-3 w-3" />
      {label ?? "Test Mode"}
    </Badge>
  );
}

/** Global banner shown to every tester while Test Mode is engaged. */
export function TestModeBanner() {
  const { testMode, note } = useTestMode();
  if (!testMode) return null;
  return (
    <div
      role="status"
      className="w-full bg-warning/15 border-b border-warning/40 px-4 py-2 text-xs sm:text-sm flex items-center justify-center gap-2 text-warning-foreground"
    >
      <FlaskConical className="h-4 w-4 shrink-0" />
      <span className="font-semibold">Test Mode active</span>
      <span className="text-muted-foreground hidden sm:inline">
        · {note || "Safety and demo overrides engaged — all features unlocked, payments bypassed."}
      </span>
    </div>
  );
}
