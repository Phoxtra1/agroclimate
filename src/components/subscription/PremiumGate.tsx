import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { PremiumComponent, COMPONENT_LABELS } from "@/lib/subscriptions/plans";
import { useTestModeEntitlement } from "@/hooks/useTestModeEntitlement";
import { SubscriptionDialog } from "@/components/subscription/SubscriptionDialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, CloudRain, Loader2, ShieldCheck, Sprout } from "lucide-react";
import premiumClimateAccess from "@/assets/premium-climate-access.jpg";

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
  const { allowed, loading } = useTestModeEntitlement(component);
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
      <>
        <SubscriptionDialog
          open={!dismissed}
          onCancel={() => setDismissed(true)}
          redirectPath={location.pathname}
          componentLabel={COMPONENT_LABELS[component]}
        />
        {dismissed && (
          <section className="min-h-[calc(100vh-8rem)] bg-background">
            <div className="relative min-h-[24rem] overflow-hidden border-b border-border">
              <img
                src={premiumClimateAccess}
                alt="Weather monitoring station overlooking cultivated fields"
                width={1200}
                height={720}
                className="absolute inset-0 h-full w-full object-cover object-right"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/20" />
              <div className="relative z-10 flex min-h-[24rem] max-w-6xl items-center px-6 py-12 lg:px-10">
                <div className="max-w-xl space-y-5">
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-sm font-semibold">Premium intelligence</span>
                  </div>
                  <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                    Upgrade to access {COMPONENT_LABELS[component]}
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Bring climate conditions, agricultural planning, and operational insight together in one decision-ready workspace.
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-foreground">
                    <span className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-primary" /> Climate intelligence</span>
                    <span className="flex items-center gap-2"><Sprout className="h-4 w-4 text-primary" /> Farm decision support</span>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button onClick={() => location.pathname && (window.location.href = `/subscription?return=${encodeURIComponent(location.pathname)}`)} className="gap-2">
                      View plans <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setDismissed(false)}>Review access</Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  return <>{children}</>;
}
