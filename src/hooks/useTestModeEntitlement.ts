import { useTestMode } from "@/hooks/useTestMode";
import { useSubscription } from "@/hooks/useSubscription";
import { PremiumComponent } from "@/lib/subscriptions/plans";

export interface Entitlement {
  /** Whether the feature may be used right now. */
  allowed: boolean;
  /** True when access is granted only because Test Mode is engaged. */
  viaTestMode: boolean;
  /** Global Test Mode flag (useful for badges/banners). */
  testMode: boolean;
  loading: boolean;
}

/**
 * Feature gating hook.
 *
 * - Test Mode ON  → returns allowed = true for every feature key, with no
 *   subscription/tier evaluation at all.
 * - Test Mode OFF → falls back to the normal user tier permission logic.
 *
 * `featureKey` is a plain string so the engine stays modular: no payment plan
 * names are hardcoded into the Test Mode layer.
 */
export function useTestModeEntitlement(featureKey: string): Entitlement {
  const { testMode, loading: testLoading } = useTestMode();
  const { hasAccess, loading: subLoading } = useSubscription();

  if (testMode) {
    return { allowed: true, viaTestMode: true, testMode: true, loading: false };
  }

  return {
    allowed: hasAccess(featureKey as PremiumComponent),
    viaTestMode: false,
    testMode: false,
    loading: testLoading || subLoading,
  };
}
