import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Global Pilot Mode — when ON, all subscription/paywall checks are bypassed. */
export function usePilotMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    return localStorage.getItem("global_pilot_enabled") === "true";
  });
  const [paywallDisabled, setPaywallDisabled] = useState<boolean>(() => {
    const val = localStorage.getItem("global_pilot_paywall_disabled");
    return val === null ? true : val === "true";
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "global_pilot_mode")
        .maybeSingle();
      
      if (!error && data) {
        const val = data.value as any;
        const isEnabled = !!val?.enabled;
        const isPaywallDisabled = val?.paywall_disabled !== false;
        
        setEnabled(isEnabled);
        setPaywallDisabled(isPaywallDisabled);
        localStorage.setItem("global_pilot_enabled", isEnabled ? "true" : "false");
        localStorage.setItem("global_pilot_paywall_disabled", isPaywallDisabled ? "true" : "false");
      }
    } catch (err) {
      console.error("Error loading pilot mode:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("global-pilot-mode")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: "key=eq.global_pilot_mode" },
        (payload: any) => {
          const val = payload.new?.value as any;
          const isEnabled = !!val?.enabled;
          const isPaywallDisabled = val?.paywall_disabled !== false;
          
          setEnabled(isEnabled);
          setPaywallDisabled(isPaywallDisabled);
          localStorage.setItem("global_pilot_enabled", isEnabled ? "true" : "false");
          localStorage.setItem("global_pilot_paywall_disabled", isPaywallDisabled ? "true" : "false");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setPilotMode = async (isEnabled: boolean, isPaywallDisabled: boolean) => {
    setEnabled(isEnabled);
    setPaywallDisabled(isPaywallDisabled);
    localStorage.setItem("global_pilot_enabled", isEnabled ? "true" : "false");
    localStorage.setItem("global_pilot_paywall_disabled", isPaywallDisabled ? "true" : "false");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("system_settings").upsert(
        { 
          key: "global_pilot_mode", 
          value: { enabled: isEnabled, paywall_disabled: isPaywallDisabled } as any, 
          updated_by: user?.id ?? null 
        },
        { onConflict: "key" }
      );
    } catch (err) {
      console.error("Error setting pilot mode:", err);
    }
  };

  return { enabled, paywallDisabled, loading, setPilotMode };
}
