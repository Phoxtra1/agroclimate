import { ReactNode } from "react";
import { PremiumComponent } from "@/lib/subscriptions/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { usePilotMode } from "@/hooks/usePilotMode";

interface Props {
  component: PremiumComponent;
  children: ReactNode;
}

/**
 * Paywall is temporarily deactivated for testing.
 *
 * The subscription and pilot hooks are still invoked so the architecture,
 * pricing logic, and subscription state remain intact. All premium
 * components are rendered unconditionally.
 */
export function PremiumGate({ component, children }: Props) {
  // Keep hooks alive for future reactivation; their results are intentionally ignored.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { enabled: pilot, paywallDisabled, loading: pilotLoading } = usePilotMode();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hasAccess, loading: subLoading } = useSubscription();

  void pilot;
  void paywallDisabled;
  void pilotLoading;
  void subLoading;
  void hasAccess(component);

  return <>{children}</>;
}
