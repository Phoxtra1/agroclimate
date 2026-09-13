import { useTestMode } from "@/hooks/useTestMode";
import { FlaskConical } from "lucide-react";

export function TestModeBanner() {
  const { testMode, note } = useTestMode();

  if (!testMode) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 px-4 py-1 text-xs font-medium flex items-center justify-center gap-1.5">
      <FlaskConical className="h-3.5 w-3.5 animate-pulse text-amber-500" />
      <span className="font-semibold">Test Mode active</span>
      {note && <span className="text-muted-foreground hidden sm:inline">· {note}</span>}
    </div>
  );
}
