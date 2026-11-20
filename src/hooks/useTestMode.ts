import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TEST_MODE,
  TEST_MODE_EVENT,
  TEST_MODE_SETTINGS_KEY,
  TEST_MODE_STORAGE_KEY,
  TestModeState,
} from "@/lib/testMode";

/**
 * Persistent, globally-synced Test Mode.
 *
 * - Reads instantly from LocalStorage (`settings.testMode`) so gating never flashes.
 * - Syncs with the backend `system_settings` row so every device/tester agrees.
 * - Writes go through the `test-mode` edge function (admin-only, server verified).
 */
export function useTestMode() {
  const [state, setState] = useState<TestModeState>(DEFAULT_TEST_MODE);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((next: TestModeState) => {
    setState(next);
    try {
      localStorage.setItem(TEST_MODE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The server remains authoritative if local storage is unavailable.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      // Read the authoritative value through the server function. This avoids
      // relying on broad client SELECT permissions for system_settings.
      const { data, error } = await supabase.functions.invoke("test-mode", {
        body: { action: "get" },
      });
      if (error || data?.error || !data?.state) {
        apply(DEFAULT_TEST_MODE);
        if (error || data?.error) {
          console.warn("[testMode] server state unavailable; failing closed", error || data.error);
        }
        return;
      }

      const val = data.state as TestModeState;
      apply({
        enabled: !!val.enabled,
        note: val.note ?? undefined,
        updatedAt: val.updatedAt ?? undefined,
      });
    } catch (err) {
      console.warn("[testMode] load failed; disabling local Test Mode", err);
      apply(DEFAULT_TEST_MODE);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    load();

    // Local events are only invalidation signals. Never accept their payload
    // as an entitlement; reload the server-authoritative state instead.
    const onLocal = () => { void load(); };
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
      const { data, error } = await supabase.functions.invoke("test-mode", {
        body: { action: "set", enabled, note },
      });
      if (error || data?.error || !data?.state) {
        await load();
        throw new Error(data?.error || error?.message || "Could not update Test Mode");
      }
      const confirmedState = data.state as TestModeState;
      apply(confirmedState);
      return confirmedState;
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
