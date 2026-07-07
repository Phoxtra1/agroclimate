import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Persistent per-user preferences (streaming view, retry/backoff, misc settings).
 * All changes save permanently to public.user_preferences.
 */
export function useUserPreferences<T extends Record<string, any> = Record<string, any>>() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("prefs")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mounted) {
        setPrefs(((data?.prefs as T) || ({} as T)));
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const setPref = useCallback(async <K extends keyof T>(key: K, value: T[K]) => {
    if (!user) return;
    const next = { ...prefs, [key]: value } as T;
    setPrefs(next);
    await supabase.from("user_preferences").upsert(
      { user_id: user.id, prefs: next as any },
      { onConflict: "user_id" }
    );
  }, [user, prefs]);

  const setMany = useCallback(async (patch: Partial<T>) => {
    if (!user) return;
    const next = { ...prefs, ...patch } as T;
    setPrefs(next);
    await supabase.from("user_preferences").upsert(
      { user_id: user.id, prefs: next as any },
      { onConflict: "user_id" }
    );
  }, [user, prefs]);

  return { prefs, setPref, setMany, loading };
}
