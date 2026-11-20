import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/offlineQueue";

export interface HarvestEntry {
  id: string;
  user_id: string;
  crop_name: string;
  quantity: number;
  unit: string;
  harvest_date: string;
  storage_location: string | null;
  storage_method: string | null;
  notes: string | null;
  photos: string[] | null;
  risk_override: string | null;
  created_at: string;
  updated_at: string;
}

export type RiskLevel = "safe" | "warning" | "danger";

// Compute spoilage risk based on days stored & storage method.
// Simple, transparent rules — easy for admins to override later.
export function computeRisk(entry: Pick<HarvestEntry, "harvest_date" | "storage_method" | "risk_override">): {
  level: RiskLevel;
  days: number;
  message: string;
} {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(entry.harvest_date).getTime()) / 86_400_000),
  );

  if (entry.risk_override === "safe" || entry.risk_override === "warning" || entry.risk_override === "danger") {
    return { level: entry.risk_override as RiskLevel, days, message: messageFor(entry.risk_override as RiskLevel, days) };
  }

  const method = (entry.storage_method || "").toLowerCase();
  // Open / bagged storage spoils faster than sealed / crib
  const fast = method.includes("open") || method.includes("bag");
  const slow = method.includes("sealed") || method.includes("container") || method.includes("crib");

  let safeMax = 7;
  let warnMax = 14;
  if (fast) { safeMax = 4; warnMax = 9; }
  if (slow) { safeMax = 14; warnMax = 30; }

  let level: RiskLevel = "safe";
  if (days > warnMax) level = "danger";
  else if (days > safeMax) level = "warning";

  return { level, days, message: messageFor(level, days) };
}

function messageFor(level: RiskLevel, days: number): string {
  if (level === "danger") return `Age-based estimate: stored ${days} days. Inspect promptly for spoilage, pests and moisture.`;
  if (level === "warning") return `Age-based estimate: stored ${days} days. Check for mold, pests and excess moisture.`;
  return `No age-based warning at ${days} days. This is not a measurement of storage conditions or produce safety.`;
}

export function usePostHarvest() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HarvestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user) { setEntries([]); activeUserIdRef.current = null; setLoading(false); return; }
    setLoading(true);
    if (activeUserIdRef.current !== user.id) {
      setEntries([]);
      activeUserIdRef.current = user.id;
    }
    const { data, error } = await supabase
      .from("post_harvest_entries" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("harvest_date", { ascending: false });
    if (!error && data) setEntries(data as unknown as HarvestEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Realtime: re-fetch on any change to this user's entries
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("post-harvest-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_harvest_entries", filter: `user_id=eq.${user.id}` },
        () => fetchEntries(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchEntries]);

  // Re-tick every minute so "days since" and risk update without refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const addEntry = async (input: Omit<HarvestEntry, "id" | "user_id" | "created_at" | "updated_at" | "photos" | "risk_override"> & { photos?: string[]; client_idempotency_key?: string }) => {
    if (!user) throw new Error("Not signed in");
    const clientKey = input.client_idempotency_key || crypto.randomUUID();
    const { data: existing, error: lookupError } = await supabase
      .from("post_harvest_entries" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("client_idempotency_key", clientKey)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from("post_harvest_entries" as any)
      .insert({ ...input, client_idempotency_key: clientKey, user_id: user.id, photos: input.photos || [] } as any)
      .select()
      .single();
    if (error?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("post_harvest_entries" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("client_idempotency_key", clientKey)
        .maybeSingle();
      if (!duplicateError && duplicate) return duplicate;
    }
    if (error) throw error;
    return data;
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("post_harvest_entries" as any).delete().eq("id", id);
  };

  const updateEntry = async (id: string, patch: Partial<HarvestEntry>) => {
    await supabase.from("post_harvest_entries" as any).update(patch as any).eq("id", id);
  };

  return { entries, loading, fetchEntries, addEntry, deleteEntry, updateEntry };
}

export async function uploadHarvestPhoto(userId: string, file: File, idempotencyKey?: string, photoIndex = 0): Promise<string> {
  const prepared = await compressImage(file);
  const mimeType = prepared.type || file.type || "image/jpeg";
  const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const safeKey = (idempotencyKey || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${userId}/harvest-${safeKey}-${photoIndex}.${ext}`;
  const { error } = await supabase.storage.from("harvest-photos").upload(path, prepared, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("harvest-photos").getPublicUrl(path);
  return data.publicUrl;
}
