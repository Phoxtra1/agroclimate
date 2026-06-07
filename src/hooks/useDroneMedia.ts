import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DroneMediaItem {
  id: string;
  media_type: string;
  storage_path: string;
  captured_at: string;
  archived: boolean;
  metadata: any;
  mission_id?: string | null;
  signedUrl?: string;
}

export function useDroneMedia() {
  const [items, setItems] = useState<DroneMediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); return; }
      const { data } = await supabase
        .from("drone_media")
        .select("*")
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false })
        .limit(100);
      const rows = (data || []) as DroneMediaItem[];
      const withUrls = await Promise.all(rows.map(async (r) => {
        const { data: signed } = await supabase.storage.from("drone-media").createSignedUrl(r.storage_path, 60 * 60);
        return { ...r, signedUrl: signed?.signedUrl };
      }));
      setItems(withUrls);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = async (file: Blob, opts: { mediaType: "image" | "video" | "log" | "report"; missionId?: string; metadata?: any }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const ext = opts.mediaType === "video" ? "webm" : opts.mediaType === "image" ? "jpg" : "json";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("drone-media").upload(path, file);
    if (upErr) throw upErr;
    const { data, error } = await supabase.from("drone_media").insert({
      user_id: user.id, mission_id: opts.missionId ?? null,
      media_type: opts.mediaType, storage_path: path, metadata: opts.metadata || {},
    }).select("*").maybeSingle();
    if (error) throw error;
    await refresh();
    return data as DroneMediaItem;
  };

  const archive = async (id: string, archived: boolean) => {
    await supabase.from("drone_media").update({ archived }).eq("id", id);
    refresh();
  };

  const remove = async (id: string, path: string) => {
    await supabase.storage.from("drone-media").remove([path]);
    await supabase.from("drone_media").delete().eq("id", id);
    refresh();
  };

  return { items, loading, refresh, upload, archive, remove };
}
