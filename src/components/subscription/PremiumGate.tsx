import { ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock, Sparkles, ArrowLeft } from "lucide-react";
import { PremiumComponent, COMPONENT_LABELS, PLANS } from "@/lib/subscriptions/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { usePilotMode } from "@/hooks/useTestMode";
import { SubscriptionDialog } from "./SubscriptionDialog";
import { Button } from "@/components/ui/button";

interface Props {
  component: PremiumComponent;
  children: ReactNode;
}

/**
  * PremiumGate enforces subscription paywalls based on pricing logic.
  * When Test Mode is active (global pilot enabled and paywalls disabled),
  * all features remain accessible for testing.
  */
export function PremiumGate({ component, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(true);

  const { enabled: pilotEnabled, paywallDisabled, loading: pilotLoading } = usePilotMode();
  const { loading: subLoading, hasAccess } = useSubscription();

  // Test mode active check: when pilot/test mode is enabled and paywalls are disabled, bypass paywall
  const isTestModeActive = pilotEnabled && paywallDisabled;

  if (pilotLoading || subLoading) {
    return <>{children}</>;
  }

  // Bypass paywall if Test Mode is active OR user's plan has access according to pricing logic
  if (isTestModeActive || hasAccess(component)) {
    return <>{children}</>;
  }

  // Paywall enforcement according to pricing logic
  const label = COMPONENT_LABELS[component] || component;
  const requiredPlan = PLANS.find((p) => p.components.includes(component));

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 shadow-sm space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
            <Sparkles className="w-3 h-3" /> Premium Feature
          </span>
          <h2 className="text-2xl font-bold tracking-tight">{label}</h2>
          <p className="text-sm text-muted-foreground">
            Access to {label} requires an active plan subscription.
            {requiredPlan && (
              <span className="block mt-1 font-medium text-foreground">
                Available on <span className="text-primary">{requiredPlan.name} Plan</span> (${requiredPlan.priceUsd}/mo) and above.
              </span>
            )}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Button className="gap-2" onClick={() => navigate(`/subscription?return=${encodeURIComponent(location.pathname)}`)}>
            <Sparkles className="w-4 h-4" />
            View Subscription Plans
          </Button>
        </div>
      </div>

      <SubscriptionDialog
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        redirectPath={location.pathname}
        componentLabel={label}
      />
    </div>
  );
}
