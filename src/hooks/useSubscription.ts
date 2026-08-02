import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PlanId, PremiumComponent, planAllows } from "@/lib/subscriptions/plans";

export interface ActiveSubscription {
  plan: PlanId;
  status: string;
  expires_at: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setSub(null); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("plan,status,expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) {
        console.warn("[useSubscription] Fetch error:", error);
        setSub({ plan: "freemium", status: "active", expires_at: null });
      } else {
        setSub((data as any) ?? { plan: "freemium", status: "active", expires_at: null });
      }
    } catch (err) {
      console.error("[useSubscription] Fetch failed:", err);
      setSub({ plan: "freemium", status: "active", expires_at: null });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const hasAccess = (comp: PremiumComponent) => planAllows(sub?.plan, comp);

  return { subscription: sub, loading, hasAccess, reload: load };
}
