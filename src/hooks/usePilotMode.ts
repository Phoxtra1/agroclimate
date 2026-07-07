import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Global Pilot Mode — when ON, all subscription/paywall checks are bypassed. */
export function usePilotMode() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "global_pilot_mode")
      .maybeSingle();
    setEnabled(!!(data?.value as any)?.enabled);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("global-pilot-mode")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: "key=eq.global_pilot_mode" },
        (payload: any) => setEnabled(!!(payload.new?.value)?.enabled)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setPilotMode = async (val: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("system_settings").upsert(
      { key: "global_pilot_mode", value: { enabled: val } as any, updated_by: user?.id ?? null },
      { onConflict: "key" }
    );
    setEnabled(val);
  };

  return { enabled, loading, setPilotMode };
}
