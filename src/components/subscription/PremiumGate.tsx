import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { PremiumComponent, COMPONENT_LABELS } from "@/lib/subscriptions/plans";
import { useTestModeEntitlement } from "@/hooks/useTestModeEntitlement";
import { SubscriptionDialog } from "@/components/subscription/SubscriptionDialog";
import { TestModeBadge } from "@/components/system/TestModeBanner";
import { Loader2 } from "lucide-react";

interface Props {
  component: PremiumComponent;
  children: ReactNode;
}

/**
 * Subscription paywall.
 *
 * Access is resolved through the Test Mode entitlement engine:
 * Test Mode ON unlocks everything, Test Mode OFF enforces the user's plan.
 */
export function PremiumGate({ component, children }: Props) {
  const { allowed, viaTestMode, loading } = useTestModeEntitlement(component);
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <SubscriptionDialog
        open={!dismissed}
        onCancel={() => setDismissed(true)}
        redirectPath={location.pathname}
        componentLabel={COMPONENT_LABELS[component]}
      />
    );
  }

  return (
    <>
      {viaTestMode && (
        <div className="px-4 pt-3">
          <TestModeBadge label={`${COMPONENT_LABELS[component]} unlocked by Test Mode`} />
        </div>
      )}
      {children}
    </>
  );
}
