import { usePilotMode } from "@/hooks/usePilotMode";
import { FlaskConical } from "lucide-react";

export function TestModeBanner() {
  const { enabled, paywallDisabled } = usePilotMode();
  const isTestMode = enabled && paywallDisabled;

  if (!isTestMode) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 px-4 py-1 text-xs font-medium flex items-center justify-between">
      <div className="flex items-center gap-1.5 mx-auto">
        <FlaskConical className="h-3.5 w-3.5 animate-pulse text-amber-500" />
        <span>
          <strong>Test Mode Active:</strong> All premium features & subscription paywalls are unlocked for testing.
        </span>
      </div>
    </div>
  );
}
