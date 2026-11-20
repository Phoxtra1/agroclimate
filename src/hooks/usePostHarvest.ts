import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/offlineQueue";
import { buildHarvestPhotoPath, createHarvestIdempotencyKey } from "@/lib/harvestIdempotency";

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
  const requestVersion = useRef(0);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;

  const fetchEntries = useCallback(async () => {
    const userId = user?.id;
    if ((userId ?? null) !== currentUserId.current) return;
    const version = ++requestVersion.current;
    if (!userId) { setEntries([]); setLoading(false); return; }
    setEntries([]);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("post_harvest_entries" as any)
        .select("*")
        .eq("user_id", userId)
        .order("harvest_date", { ascending: false });
      if (version !== requestVersion.current || userId !== currentUserId.current) return;
      if (error) throw error;
      setEntries((data as unknown as HarvestEntry[]) || []);
    } catch (error) {
      if (version === requestVersion.current && userId === currentUserId.current) {
        setEntries([]);
        console.error("[PostHarvest] Could not load harvest entries", error);
      }
    } finally {
      if (version === requestVersion.current && userId === currentUserId.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchEntries();
    return () => { requestVersion.current += 1; };
  }, [fetchEntries]);

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
  }, [user?.id, fetchEntries]);

  // Re-tick every minute so "days since" and risk update without refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const addEntry = async (input: Omit<HarvestEntry, "id" | "user_id" | "created_at" | "updated_at" | "photos" | "risk_override"> & { photos?: string[]; client_idempotency_key?: string }) => {
    if (!user?.id || user.id !== currentUserId.current) throw new Error("Your session changed. Sign in again before saving.");
    const userId = user.id;
    const quantity = Number(input.quantity);
    if (!input.crop_name?.trim()) throw new Error("Crop name is required.");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Harvest quantity must be greater than zero.");
    if (!input.unit?.trim()) throw new Error("Harvest unit is required.");
    if (!input.harvest_date || Number.isNaN(Date.parse(input.harvest_date))) throw new Error("A valid harvest date is required.");
    const clientKey = input.client_idempotency_key || createHarvestIdempotencyKey();
    const { data: existing, error: lookupError } = await supabase
      .from("post_harvest_entries" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("client_idempotency_key", clientKey)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (userId !== currentUserId.current) throw new Error("Your session changed while the harvest was being saved.");
    if (existing) return existing;

    const { data, error } = await supabase
      .from("post_harvest_entries" as any)
      .insert({ ...input, crop_name: input.crop_name.trim(), quantity, client_idempotency_key: clientKey, user_id: userId, photos: input.photos || [] } as any)
      .select()
      .single();
    if (error?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("post_harvest_entries" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("client_idempotency_key", clientKey)
        .maybeSingle();
      if (!duplicateError && duplicate) return duplicate;
    }
    if (error) throw error;
    if (userId !== currentUserId.current) throw new Error("Your session changed after the harvest was saved. Sign in again to refresh.");
    return data;
  };

  const deleteEntry = async (id: string) => {
    if (!user?.id || user.id !== currentUserId.current) throw new Error("Your session changed. Refresh and try again.");
    const { data, error } = await supabase.from("post_harvest_entries" as any)
      .delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Harvest entry not found or access denied");
    await fetchEntries();
  };

  const updateEntry = async (id: string, patch: Partial<HarvestEntry>) => {
    if (!user?.id || user.id !== currentUserId.current) throw new Error("Your session changed. Refresh and try again.");
    const safePatch = { ...patch } as Record<string, unknown>;
    for (const key of ["id", "user_id", "created_at", "updated_at", "client_idempotency_key"]) delete safePatch[key];
    const { data, error } = await supabase.from("post_harvest_entries" as any)
      .update(safePatch as any).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Harvest entry not found or access denied");
    await fetchEntries();
  };

  return { entries, loading, fetchEntries, addEntry, deleteEntry, updateEntry };
}

export async function uploadHarvestPhoto(userId: string, file: File, idempotencyKey?: string, photoIndex = 0): Promise<string> {
  const prepared = await compressImage(file);
  const mimeType = prepared.type || file.type || "image/jpeg";
  const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = buildHarvestPhotoPath(userId, idempotencyKey || createHarvestIdempotencyKey(), photoIndex, ext);
  const { error } = await supabase.storage.from("harvest-photos").upload(path, prepared, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("harvest-photos").getPublicUrl(path);
  return data.publicUrl;
}
