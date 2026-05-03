// Lightweight offline queue for harvest entries + photos.
// Uses localStorage (small, simple, survives refresh) + a base64 photo cache.
// Auto-syncs when the browser regains connectivity.

import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "agc_pending_harvests_v1";
const PHOTOS_KEY = "agc_pending_photos_v1";

export interface PendingHarvest {
  id: string; // local uuid
  user_id: string;
  crop_name: string;
  quantity: number;
  unit: string;
  harvest_date: string;
  storage_location: string | null;
  storage_method: string | null;
  notes: string | null;
  photo_keys: string[]; // refs into photo cache
  queued_at: number;
}

interface CachedPhoto {
  key: string;
  user_id: string;
  filename: string;
  type: string;
  data_url: string; // base64
}

function readQueue(): PendingHarvest[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function writeQueue(items: PendingHarvest[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("agc:queue-changed"));
}
function readPhotos(): Record<string, CachedPhoto> {
  try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); } catch { return {}; }
}
function writePhotos(photos: Record<string, CachedPhoto>) {
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Downscale + JPEG-compress an image to reduce storage and upload time
async function compressImage(file: File, maxEdge = 1280, quality = 0.7): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const dataUrl = await fileToDataUrl(file);
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r, j) => { img.onload = r; img.onerror = j; });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const r = await fetch(dataUrl);
  return r.blob();
}

export async function queueHarvest(
  entry: Omit<PendingHarvest, "id" | "photo_keys" | "queued_at">,
  files: File[],
): Promise<PendingHarvest> {
  const photos = readPhotos();
  const photo_keys: string[] = [];
  for (const f of files) {
    const key = `${entry.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    photos[key] = { key, user_id: entry.user_id, filename: f.name, type: f.type || "image/jpeg", data_url: await fileToDataUrl(f) };
    photo_keys.push(key);
  }
  writePhotos(photos);

  const item: PendingHarvest = {
    ...entry,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    photo_keys,
    queued_at: Date.now(),
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function getPendingCount(): number {
  return readQueue().length;
}

export function getPendingItems(): PendingHarvest[] {
  return readQueue();
}

let syncing = false;
export async function syncPendingHarvests(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0, failed = 0;
  try {
    const queue = readQueue();
    if (!queue.length) return { synced: 0, failed: 0 };
    const photos = readPhotos();
    const remaining: PendingHarvest[] = [];

    for (const item of queue) {
      try {
        // Upload photos first
        const photoUrls: string[] = [];
        for (const k of item.photo_keys) {
          const cached = photos[k];
          if (!cached) continue;
          const blob = await dataUrlToBlob(cached.data_url);
          const ext = (cached.filename.split(".").pop() || "jpg").toLowerCase();
          const path = `${cached.user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("harvest-photos")
            .upload(path, blob, { contentType: cached.type, upsert: false });
          if (upErr) throw upErr;
          const { data } = supabase.storage.from("harvest-photos").getPublicUrl(path);
          photoUrls.push(data.publicUrl);
        }

        const { error } = await supabase.from("post_harvest_entries" as any).insert({
          user_id: item.user_id,
          crop_name: item.crop_name,
          quantity: item.quantity,
          unit: item.unit,
          harvest_date: item.harvest_date,
          storage_location: item.storage_location,
          storage_method: item.storage_method,
          notes: item.notes,
          photos: photoUrls,
        } as any);
        if (error) throw error;

        // Cleanup cached photos
        for (const k of item.photo_keys) delete photos[k];
        synced++;
      } catch {
        failed++;
        remaining.push(item);
      }
    }

    writeQueue(remaining);
    writePhotos(photos);
  } finally {
    syncing = false;
  }
  return { synced, failed };
}

// Auto-sync wiring (idempotent)
let installed = false;
export function installOfflineSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const tryRun = () => { void syncPendingHarvests(); };
  window.addEventListener("online", tryRun);
  // Best-effort periodic retry
  setInterval(tryRun, 60_000);
  // Try once on load
  setTimeout(tryRun, 2000);
}
