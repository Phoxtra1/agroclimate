import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TEST_MODE,
  TEST_MODE_EVENT,
  TEST_MODE_SETTINGS_KEY,
  TestModeState,
  readLocalTestMode,
  writeLocalTestMode,
} from "@/lib/testMode";

/**
 * Persistent, globally-synced Test Mode.
 *
 * - Reads instantly from LocalStorage (`settings.testMode`) so gating never flashes.
 * - Syncs with the backend `system_settings` row so every device/tester agrees.
 * - Writes go through the `test-mode` edge function (admin-only, server verified).
 */
export function useTestMode() {
  const [state, setState] = useState<TestModeState>(() => readLocalTestMode());
  const [loading, setLoading] = useState(true);

  const apply = useCallback((next: TestModeState) => {
    setState(next);
    writeLocalTestMode(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", TEST_MODE_SETTINGS_KEY)
        .maybeSingle();
      if (!error && data) {
        const val = (data.value ?? {}) as any;
        apply({
          enabled: !!val.enabled,
          note: val.note ?? undefined,
          updatedAt: val.updated_at ?? undefined,
        });
      } else if (!error && !data) {
        apply(DEFAULT_TEST_MODE);
      }
    } catch (err) {
      console.warn("[testMode] load failed, using local state", err);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    load();

    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail as TestModeState | undefined;
      if (detail) setState(detail);
    };
    window.addEventListener(TEST_MODE_EVENT, onLocal);

    const ch = supabase
      .channel("system-test-mode")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_settings",
          filter: `key=eq.${TEST_MODE_SETTINGS_KEY}`,
        },
        (payload: any) => {
          const val = (payload.new?.value ?? {}) as any;
          apply({
            enabled: !!val.enabled,
            note: val.note ?? undefined,
            updatedAt: val.updated_at ?? undefined,
          });
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener(TEST_MODE_EVENT, onLocal);
      supabase.removeChannel(ch);
    };
  }, [load, apply]);

  /** Admin-only. Persists globally via the edge function. */
  const setTestMode = useCallback(
    async (enabled: boolean, note?: string) => {
      const optimistic: TestModeState = { enabled, note, updatedAt: new Date().toISOString() };
      apply(optimistic);
      const { data, error } = await supabase.functions.invoke("test-mode", {
        body: { action: "set", enabled, note },
      });
      if (error || data?.error) {
        await load();
        throw new Error(data?.error || error?.message || "Could not update Test Mode");
      }
      return data?.state as TestModeState;
    },
    [apply, load]
  );

  return {
    testMode: state.enabled,
    note: state.note,
    updatedAt: state.updatedAt,
    loading,
    setTestMode,
    reload: load,
  };
}
