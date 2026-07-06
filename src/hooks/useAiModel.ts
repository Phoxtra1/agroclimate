import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AI_MODELS, AiModelOption, DEFAULT_MODEL, findModel } from "@/lib/ai/modelRegistry";

const LS_KEY = "agyenkwa_active_ai_model";

function readCache(): AiModelOption {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_MODEL;
    const parsed = JSON.parse(raw);
    return findModel(parsed?.id);
  } catch { return DEFAULT_MODEL; }
}

export function writeCache(m: AiModelOption) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ id: m.id, gateway_model: m.gatewayModel, label: m.label })); } catch {}
}

export function getActiveModelSync(): AiModelOption {
  return readCache();
}

export function useAiModel() {
  const [model, setModel] = useState<AiModelOption>(readCache);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "active_ai_model").maybeSingle();
      const id = (data?.value as any)?.id;
      const found = findModel(id);
      setModel(found);
      writeCache(found);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live sync across tabs / admins
  useEffect(() => {
    const ch = supabase.channel("system_settings_ai")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings", filter: "key=eq.active_ai_model" },
        (payload) => {
          const id = (payload.new as any)?.value?.id;
          const found = findModel(id);
          setModel(found);
          writeCache(found);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setActiveModel = useCallback(async (m: AiModelOption) => {
    setModel(m); writeCache(m);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("system_settings").upsert({
      key: "active_ai_model",
      value: { id: m.id, gateway_model: m.gatewayModel, label: m.label } as any,
      updated_by: user?.id ?? null,
    }, { onConflict: "key" });
  }, []);

  return { model, models: AI_MODELS, loading, refresh, setActiveModel };
}
