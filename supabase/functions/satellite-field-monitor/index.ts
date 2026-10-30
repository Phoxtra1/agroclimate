import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assessVegetationChange, median } from "../_shared/satellite-anomaly.ts";

const EARTH_SEARCH = "https://earth-search.aws.element84.com/v1";
const TITILER = "https://titiler.xyz";
const COLLECTION = "sentinel-2-c1-l2a";
const MAX_SCENES_PER_FIELD = 8;
const BASELINE_SCENES = 3;

type FieldGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type Field = {
  id: string;
  user_id: string;
  name: string;
  crop_type: string | null;
  field_geojson: FieldGeometry;
  max_cloud_cover: number;
  ndvi_drop_threshold: number;
  last_scene_at: string | null;
};

type Scene = {
  id: string;
  itemUrl: string;
  capturedAt: string;
  cloudCover: number | null;
};

type Stats = {
  mean: number | null;
  min: number | null;
  max: number | null;
  count: number;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statistic(payload: unknown, key: string): number | null {
  const queue: unknown[] = [payload];
  const seen = new Set<object>();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (typeof record[key] === "number" && Number.isFinite(record[key])) return record[key] as number;
    queue.push(...Object.values(record).filter((item) => item && typeof item === "object"));
  }
  return null;
}

async function fetchScenes(field: Field): Promise<Scene[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 86400000);
  const response = await fetch(`${EARTH_SEARCH}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
    body: JSON.stringify({
      collections: [COLLECTION],
      intersects: field.field_geojson,
      datetime: `${dateOnly(start)}T00:00:00Z/${dateOnly(end)}T23:59:59Z`,
      limit: 40,
      query: { "eo:cloud_cover": { lte: field.max_cloud_cover } },
    }),
  });
  if (!response.ok) throw new Error(`Earth Search failed with ${response.status}`);
  const payload = await response.json();
  const candidates = (payload.features ?? [])
    .filter((item: any) => item.id && item.geometry)
    .map((item: any) => ({
      id: item.id,
      itemUrl: item.links?.find((link: any) => link.rel === "self")?.href
        ?? `${EARTH_SEARCH}/collections/${COLLECTION}/items/${encodeURIComponent(item.id)}`,
      capturedAt: item.properties?.datetime ?? item.properties?.start_datetime,
      cloudCover: typeof item.properties?.["eo:cloud_cover"] === "number"
        ? item.properties["eo:cloud_cover"] : null,
    }))
    .filter((scene: Scene) => scene.capturedAt && (!field.last_scene_at || Date.parse(scene.capturedAt) > Date.parse(field.last_scene_at)))
    .sort((a: Scene, b: Scene) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

  // Overlapping Sentinel tiles can intersect one farm on the same acquisition day.
  // Keep the least-cloudy scene per day to avoid treating one pass as multiple observations.
  const byDay = new Map<string, Scene>();
  for (const scene of candidates) {
    const day = scene.capturedAt.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || (scene.cloudCover ?? 100) < (existing.cloudCover ?? 100)) byDay.set(day, scene);
  }
  return [...byDay.values()].slice(-MAX_SCENES_PER_FIELD);
}

async function getIndexStats(scene: Scene, geometry: Field["field_geojson"], index: "ndvi" | "ndmi"): Promise<Stats> {
  const assets = index === "ndvi" ? ["nir", "red"] : ["nir", "swir16"];
  const endpoint = new URL(`${TITILER}/stac/statistics`);
  endpoint.searchParams.set("url", scene.itemUrl);
  assets.forEach((asset) => endpoint.searchParams.append("assets", asset));
  endpoint.searchParams.set("expression", "(b1-b2)/(b1+b2)");
  endpoint.searchParams.set("unscale", "true");
  endpoint.searchParams.set("max_size", "2048");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/geo+json", Accept: "application/json" },
    body: JSON.stringify({ type: "Feature", properties: {}, geometry }),
  });
  if (!response.ok) throw new Error(`TiTiler ${index.toUpperCase()} statistics failed with ${response.status}`);
  const payload = await response.json();
  const count = statistic(payload, "count") ?? 0;
  return {
    mean: statistic(payload, "mean"),
    min: statistic(payload, "min"),
    max: statistic(payload, "max"),
    count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-satellite-monitor-secret" } });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const expectedSecret = Deno.env.get("SATELLITE_MONITOR_SECRET");
  if (!expectedSecret || req.headers.get("x-satellite-monitor-secret") !== expectedSecret) {
    return json({ error: "Unauthorized scheduled monitor request" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Supabase service configuration is missing" }, 500);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: fields, error: fieldsError } = await supabase
    .from("satellite_fields")
    .select("id,user_id,name,crop_type,field_geojson,max_cloud_cover,ndvi_drop_threshold,last_scene_at")
    .eq("monitoring_enabled", true)
    .order("last_scene_at", { ascending: true, nullsFirst: true })
    .limit(100);

  if (fieldsError) return json({ error: fieldsError.message }, 500);

  const result = { fieldsChecked: 0, scenesProcessed: 0, alertsCreated: 0, skipped: 0, errors: [] as string[] };

  for (const field of (fields ?? []) as Field[]) {
    result.fieldsChecked += 1;
    try {
      const scenes = await fetchScenes(field);
      if (!scenes.length) { result.skipped += 1; continue; }

      const { data: history, error: historyError } = await supabase
        .from("satellite_field_observations")
        .select("scene_id,captured_at,mean_ndvi,mean_ndmi,valid_pixel_count")
        .eq("field_id", field.id)
        .order("captured_at", { ascending: false })
        .limit(12);
      if (historyError) throw historyError;

      const fieldHistory: any[] = [...(history ?? [])];
      const known = new Set(fieldHistory.map((row: any) => row.scene_id));
      let lastProcessedAt = field.last_scene_at;
      for (const scene of scenes) {
        if (known.has(scene.id)) continue;
        const [ndvi, ndmi] = await Promise.all([
          getIndexStats(scene, field.field_geojson, "ndvi"),
          getIndexStats(scene, field.field_geojson, "ndmi"),
        ]);

        if (ndvi.mean === null || ndmi.mean === null || ndvi.count < 4) {
          result.skipped += 1;
          continue;
        }

        const { error: insertError } = await supabase.from("satellite_field_observations").upsert({
          field_id: field.id,
          scene_id: scene.id,
          captured_at: scene.capturedAt,
          cloud_cover: scene.cloudCover,
          mean_ndvi: ndvi.mean,
          min_ndvi: ndvi.min,
          max_ndvi: ndvi.max,
          mean_ndmi: ndmi.mean,
          valid_pixel_count: ndvi.count,
        }, { onConflict: "field_id,scene_id", ignoreDuplicates: true });
        if (insertError) throw insertError;

        const observation = {
          scene_id: scene.id,
          captured_at: scene.capturedAt,
          mean_ndvi: ndvi.mean,
          mean_ndmi: ndmi.mean,
          valid_pixel_count: ndvi.count,
        };
        const prior = fieldHistory
          .filter((row: any) => row.mean_ndvi !== null && Date.parse(row.captured_at) < Date.parse(scene.capturedAt))
          .sort((a: any, b: any) => Date.parse(b.captured_at) - Date.parse(a.captured_at))
          .slice(0, BASELINE_SCENES);

        // Require three previous clear observations. Do not alert on a new field or a single comparison.
        if (prior.length >= BASELINE_SCENES) {
          const baselineNdvi = median(prior.map((row: any) => Number(row.mean_ndvi)));
          const baselineNdmiValues = prior.map((row: any) => Number(row.mean_ndmi)).filter(Number.isFinite);
          const baselineNdmi = baselineNdmiValues.length ? median(baselineNdmiValues) : null;
          const assessment = assessVegetationChange({
            baselineNdvi,
            currentNdvi: ndvi.mean,
            baselineNdmi,
            currentNdmi: ndmi.mean,
            minimumDrop: field.ndvi_drop_threshold,
            cloudCover: scene.cloudCover,
          });
          if (assessment.isAnomaly && assessment.severity) {
            const drop = assessment.ndviDrop;
            const percentDrop = assessment.ndviDropPercent;
            const ndmiDrop = assessment.ndmiDrop;
            const corroborated = assessment.corroboratedByNdmi;
            const severity = assessment.severity;
            const confidence = assessment.confidence;
            const title = severity === "high" ? "Significant vegetation decline detected" : "Possible crop stress detected";
            const message = `${field.name}: mean NDVI fell from ${baselineNdvi.toFixed(2)} to ${ndvi.mean.toFixed(2)} (${percentDrop.toFixed(0)}% decline) in the latest clear satellite observation. ${corroborated ? "NDMI also indicates a canopy-moisture decline. " : ""}Inspect the field for water stress, pests, disease, harvest activity or other changes before taking action.`;
            const { data: alert, error: alertError } = await supabase.from("satellite_field_alerts").upsert({
              field_id: field.id,
              scene_id: scene.id,
              severity,
              title,
              message,
              baseline_ndvi: baselineNdvi,
              current_ndvi: ndvi.mean,
              ndvi_drop: drop,
              ndvi_drop_percent: percentDrop,
              baseline_ndmi: baselineNdmi,
              current_ndmi: ndmi.mean,
              ndmi_drop: ndmiDrop,
              cloud_cover: scene.cloudCover,
              valid_pixel_count: ndvi.count,
              confidence,
              captured_at: scene.capturedAt,
            }, { onConflict: "field_id,scene_id,alert_kind", ignoreDuplicates: true }).select("id").maybeSingle();
            if (alertError) throw alertError;

            if (alert?.id) {
              await supabase.from("transport_notifications").insert({
                user_id: field.user_id,
                type: "satellite_crop_stress",
                title,
                message,
                data: {
                  satellite_alert_id: alert.id,
                  field_id: field.id,
                  field_name: field.name,
                  scene_id: scene.id,
                  severity,
                  confidence,
                  ndvi_baseline: baselineNdvi,
                  ndvi_current: ndvi.mean,
                  ndvi_drop_percent: percentDrop,
                },
              });
              result.alertsCreated += 1;
            }
          }
        }

        fieldHistory.push(observation);
        known.add(scene.id);
        lastProcessedAt = scene.capturedAt;
        result.scenesProcessed += 1;
      }

      if (lastProcessedAt && lastProcessedAt !== field.last_scene_at) {
        await supabase.from("satellite_fields").update({ last_scene_at: lastProcessedAt }).eq("id", field.id);
      }
    } catch (error) {
      result.errors.push(`${field.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return json(result);
});
