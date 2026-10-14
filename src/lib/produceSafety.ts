import { z } from "zod";

export type ScanMode = "visual" | "strip";
export const scanResultSchema = z.object({
  outcome: z.enum(["no_visible_concern", "concern", "inconclusive", "reference_match"]),
  confidence: z.enum(["low", "moderate", "high"]),
  produce: z.string().max(160),
  summary: z.string().max(1200),
  observations: z.array(z.string().max(500)).max(6),
  actions: z.array(z.string().max(500)).max(5),
  referenceReading: z.string().max(800).nullable(),
});
export type ScanResult = z.infer<typeof scanResultSchema>;
export type ScanRecord = { id: string; mode: ScanMode; at: string; label: string; result: ScanResult };
export const outcomeLabels: Record<ScanResult["outcome"], string> = {
  no_visible_concern: "No visible concern identified",
  concern: "Further assessment needed",
  inconclusive: "Unable to assess reliably",
  reference_match: "Reference comparison available",
};

export function frameQuality(data: Uint8ClampedArray, previous?: Uint8ClampedArray) {
  let brightness = 0, motion = 0, edges = 0;
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i] + data[i + 1] + data[i + 2]) / 3;
    brightness += value;
    if (previous?.length === data.length) motion += Math.abs(value - (previous[i] + previous[i + 1] + previous[i + 2]) / 3);
    if (i >= 4) edges += Math.abs(value - (data[i - 4] + data[i - 3] + data[i - 2]) / 3);
  }
  const light = brightness / count;
  return { lit: light > 45 && light < 225, steady: !!previous && motion / count < 7, detail: edges / count > 5 };
}

export async function prepareScanImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose a photo smaller than 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("This photo could not be opened.");
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Photo processing is unavailable on this device.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}