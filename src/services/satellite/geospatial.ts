import { supabase } from "@/integrations/supabase/client";
import type { GeoPoint } from "@/services/satellite/navigation";

export type GeoFeatureType =
  | "farm_boundary" | "warehouse" | "silo" | "cold_store" | "collection_centre"
  | "processing_facility" | "buyer" | "supplier" | "port" | "pickup_point"
  | "delivery_point" | "drone_observation" | "water_source" | "road_hazard" | "other";

export interface GeoFeatureInput {
  featureType: GeoFeatureType;
  name: string;
  description?: string;
  visibility?: "private" | "public";
  geometry: GeoJSON.Geometry;
  properties?: Record<string, unknown>;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  acquisitionDate?: string;
  resolutionM?: number;
  confidence?: number;
  dataQuality?: "unverified" | "estimated" | "observed" | "verified";
}

export interface GeoFeatureRecord {
  id: string;
  owner_id: string | null;
  feature_type: GeoFeatureType;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  geojson: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  source_name: string | null;
  source_url: string | null;
  source_record_id: string | null;
  acquisition_date: string | null;
  resolution_m: number | null;
  confidence: number | null;
  data_quality: string;
  updated_at: string;
}

export interface GeoObservationInput {
  featureId?: string;
  observationType: string;
  observedAt?: string;
  sourceName?: string;
  sourceUrl?: string;
  resolutionM?: number;
  confidence?: number;
  metrics?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

function assertGeometry(geometry: GeoJSON.Geometry) {
  if (!geometry || !["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"].includes(geometry.type)) {
    throw new Error("A supported GeoJSON geometry is required.");
  }
}

export async function createGeoFeature(input: GeoFeatureInput): Promise<GeoFeatureRecord> {
  assertGeometry(input.geometry);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to save a geospatial record.");

  const { data, error } = await (supabase.from("geo_features" as any) as any).insert({
    owner_id: userData.user.id,
    feature_type: input.featureType,
    name: input.name.trim(),
    description: input.description ?? null,
    visibility: input.visibility ?? "private",
    geojson: input.geometry,
    properties: input.properties ?? {},
    source_name: input.sourceName ?? null,
    source_url: input.sourceUrl ?? null,
    source_record_id: input.sourceRecordId ?? null,
    acquisition_date: input.acquisitionDate ?? null,
    resolution_m: input.resolutionM ?? null,
    confidence: input.confidence ?? null,
    data_quality: input.dataQuality ?? "unverified",
  }).select("*").single();

  if (error) throw new Error(error.message || "Could not save the map feature.");
  return data as GeoFeatureRecord;
}

export async function listGeoFeatures(options: {
  featureTypes?: GeoFeatureType[];
  limit?: number;
} = {}): Promise<GeoFeatureRecord[]> {
  let query = (supabase.from("geo_features" as any) as any)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, options.limit ?? 200)));

  if (options.featureTypes?.length) query = query.in("feature_type", options.featureTypes);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load map features.");
  return (data ?? []) as GeoFeatureRecord[];
}

export async function recordGeoObservation(input: GeoObservationInput) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to save this observation.");

  const { data, error } = await (supabase.from("geo_observations" as any) as any).insert({
    feature_id: input.featureId ?? null,
    observer_id: userData.user.id,
    observation_type: input.observationType,
    observed_at: input.observedAt ?? new Date().toISOString(),
    source_name: input.sourceName ?? null,
    source_url: input.sourceUrl ?? null,
    resolution_m: input.resolutionM ?? null,
    confidence: input.confidence ?? null,
    metrics: input.metrics ?? {},
    evidence: input.evidence ?? {},
  }).select("*").single();

  if (error) throw new Error(error.message || "Could not save this observation.");
  return data;
}

export async function saveSharedRoadRoute(input: {
  routeType: "road" | "freight" | "tractor" | "walking";
  origin: GeoPoint & { label?: string };
  destination: GeoPoint & { label?: string };
  geometry: [number, number][];
  distanceM: number;
  durationS: number;
  provider: string;
  calculatedAt?: string;
}) {
  if (input.geometry.length < 2) throw new Error("A real route geometry is required.");
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to save an offline route.");

  const { data, error } = await (supabase.from("geo_routes" as any) as any).insert({
    user_id: userData.user.id,
    route_type: input.routeType,
    origin: input.origin,
    destination: input.destination,
    geometry: { type: "LineString", coordinates: input.geometry.map(([lat, lon]) => [lon, lat]) },
    distance_m: input.distanceM,
    duration_s: input.durationS,
    provider: input.provider,
    status: "calculated",
    is_simulated: false,
    calculated_at: input.calculatedAt ?? new Date().toISOString(),
    last_confirmed_at: input.calculatedAt ?? new Date().toISOString(),
  }).select("*").single();

  if (error) throw new Error(error.message || "Could not save route record.");
  return data;
}

export function toPointGeometry(point: GeoPoint): GeoJSON.Point {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)
    || point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    throw new Error("Invalid WGS84 coordinates.");
  }
  return { type: "Point", coordinates: [point.lon, point.lat] };
}

export async function saveFarm(input: {
  name: string;
  location: GeoPoint;
  user_id?: string;
}) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in to save a farm location.");
  if (input.user_id && input.user_id !== userData.user.id) {
    throw new Error("You can only save a farm location under your own account.");
  }
  const point = toPointGeometry(input.location);
  const { data, error } = await (supabase.from("farms" as any) as any).insert({
    user_id: userData.user.id,
    name: input.name.trim(),
    lat: point.coordinates[1],
    lon: point.coordinates[0],
  }).select("*").single();
  if (error) throw new Error(error.message || "Could not save farm location.");
  return data;
}

export async function listFarms(userId?: string) {
  let query = (supabase.from("farms" as any) as any).select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load farm locations.");
  return data ?? [];
}
