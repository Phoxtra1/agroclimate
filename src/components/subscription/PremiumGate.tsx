import { useEffect, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PremiumComponent, COMPONENT_LABELS } from "@/lib/subscriptions/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { usePilotMode } from "@/hooks/usePilotMode";
import { SubscriptionDialog } from "./SubscriptionDialog";
import { LoadingScreen } from "@/components/LoadingScreen";

interface Props {
  component: PremiumComponent;
  children: ReactNode;
}

/**
 * Blocks rendering of a premium component until the user has access.
 * Global Pilot Mode bypasses all checks. Uses a single reusable dialog.
 */
export function PremiumGate({ component, children }: Props) {
  const { enabled: pilot, paywallDisabled, loading: pilotLoading } = usePilotMode();
  const { hasAccess, loading: subLoading } = useSubscription();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const allowed = (pilot && paywallDisabled) || hasAccess(component);

  useEffect(() => {
    if (!pilotLoading && !subLoading && !allowed) setOpen(true);
    if (allowed) setOpen(false);
  }, [pilotLoading, subLoading, allowed]);

  if (pilotLoading || subLoading) return <LoadingScreen />;
  if (allowed) return <>{children}</>;

  return (
    <>
      <div className="p-8 text-center text-sm text-muted-foreground">
        This component is available on paid plans. Choose a plan to continue.
      </div>
      <SubscriptionDialog
        open={open}
        onCancel={() => { setOpen(false); navigate("/dashboard"); }}
        redirectPath={location.pathname + location.search}
        componentLabel={COMPONENT_LABELS[component]}
      />
    </>
  );
}
