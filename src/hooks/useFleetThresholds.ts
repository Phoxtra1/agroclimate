import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FleetThresholds {
  id?: string;
  battery_warning_pct: number;
  battery_critical_pct: number;
  signal_warning_pct: number;
  signal_critical_pct: number;
  stale_timeout_sec: number;
  is_default?: boolean;
}

const FALLBACK: FleetThresholds = {
  battery_warning_pct: 25, battery_critical_pct: 15,
  signal_warning_pct: 45, signal_critical_pct: 30,
  stale_timeout_sec: 30,
};

export function useFleetThresholds() {
  const [thresholds, setThresholds] = useState<FleetThresholds>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"user" | "default" | "fallback">("fallback");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: mine } = await supabase
          .from("fleet_alert_thresholds")
          .select("*").eq("user_id", user.id).maybeSingle();
        if (mine) { setThresholds(mine as any); setScope("user"); return; }
      }
      const { data: def } = await supabase
        .from("fleet_alert_thresholds")
        .select("*").eq("is_default", true).maybeSingle();
      if (def) { setThresholds(def as any); setScope("default"); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: FleetThresholds) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sign in to save thresholds");
    const payload = { ...next, user_id: user.id, is_default: false };
    const { data, error } = await supabase
      .from("fleet_alert_thresholds")
      .upsert(payload, { onConflict: "user_id" })
      .select().maybeSingle();
    if (error) throw error;
    if (data) { setThresholds(data as any); setScope("user"); }
  }, []);

  return { thresholds, loading, scope, save, reload: load };
}
