import { supabase } from "@/integrations/supabase/client";
import type { GeoPoint } from "@/services/satellite/navigation";

export type GeoFeatureType =
  | "farm_boundary" | "farm_location" | "warehouse" | "silo" | "cold_store" | "collection_centre"
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

function toFarmBoundaryGeometry(points: [number, number][]): GeoJSON.Polygon {
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error("A farm boundary needs at least three points.");
  }
  if (points.some(([lat, lon]) =>
    !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180
  )) {
    throw new Error("Farm boundary contains invalid WGS84 coordinates.");
  }
  const unique = new Set(points.map(([lat, lon]) => `${lat.toFixed(7)},${lon.toFixed(7)}`));
  if (unique.size < 3) throw new Error("Farm boundary needs at least three distinct points.");
  const ring: [number, number][] = points.map(([lat, lon]) => [lon, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return { type: "Polygon", coordinates: [ring] };
}

export async function saveFarm(input: {
  name: string;
  location: GeoPoint;
  user_id?: string;
  boundary?: [number, number][];
}) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in to save a farm location.");
  if (input.user_id && input.user_id !== userData.user.id) {
    throw new Error("You can only save a farm location under your own account.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("Farm name is required.");
  const point = toPointGeometry(input.location);
  const boundaryGeometry = input.boundary ? toFarmBoundaryGeometry(input.boundary) : null;

  const { data: farm, error: farmError } = await (supabase.from("farms" as any) as any).insert({
    user_id: userData.user.id,
    name,
    lat: point.coordinates[1],
    lon: point.coordinates[0],
  }).select("*").single();
  if (farmError) throw new Error(farmError.message || "Could not save farm location.");

  let pointFeatureId: string | null = null;
  try {
    const { data: pointFeature, error: pointError } = await (supabase.from("geo_features" as any) as any).insert({
      owner_id: userData.user.id,
      feature_type: "farm_location",
      name,
      visibility: "private",
      geojson: point,
      properties: { farm_record_id: String(farm.id), location_method: "user_supplied" },
      source_name: "AgroClimate AgroRisk farm registration",
      data_quality: "unverified",
    }).select("id").single();
    if (pointError || !pointFeature) throw new Error(pointError?.message || "Could not save farm map location.");
    pointFeatureId = pointFeature.id;

    if (boundaryGeometry) {
      const { error: boundaryError } = await (supabase.from("geo_features" as any) as any).insert({
        owner_id: userData.user.id,
        feature_type: "farm_boundary",
        name: `${name} boundary`,
        visibility: "private",
        geojson: boundaryGeometry,
        properties: { farm_record_id: String(farm.id), boundary_method: "user_drawn" },
        source_name: "User-drawn AgroRisk farm boundary",
        data_quality: "unverified",
      });
      if (boundaryError) throw new Error(boundaryError.message || "Could not save farm boundary.");
    }

    const { data: linkedFarm, error: linkError } = await (supabase.from("farms" as any) as any)
      .update({ geo_feature_id: pointFeatureId }).eq("id", farm.id).eq("user_id", userData.user.id).select("*").single();
    if (linkError) throw new Error(linkError.message || "Could not link the farm to the shared Satellite map.");
    return linkedFarm;
  } catch (error) {
    if (pointFeatureId) {
      await (supabase.from("geo_features" as any) as any).delete().eq("id", pointFeatureId).eq("owner_id", userData.user.id);
    }
    await (supabase.from("geo_features" as any) as any).delete()
      .eq("owner_id", userData.user.id).eq("feature_type", "farm_boundary")
      .contains("properties", { farm_record_id: String(farm.id) });
    await (supabase.from("farms" as any) as any).delete().eq("id", farm.id).eq("user_id", userData.user.id);
    throw error;
  }
}

export async function listFarms(userId?: string) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return [];
  if (userId && userId !== userData.user.id) throw new Error("You can only list your own farms.");
  const ownerId = userData.user.id;
  const { data: farms, error } = await (supabase.from("farms" as any) as any)
    .select("*").eq("user_id", ownerId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load farm locations.");
  if (!farms?.length) return [];

  const { data: boundaries, error: boundaryError } = await (supabase.from("geo_features" as any) as any)
    .select("properties,geojson").eq("owner_id", ownerId).eq("feature_type", "farm_boundary");
  if (boundaryError) console.warn("[AgroRisk] Farm boundaries could not be loaded:", boundaryError.message);

  return farms.map((farm: any) => {
    const feature = (boundaries || []).find((item: any) => item.properties?.farm_record_id === String(farm.id));
    const ring = feature?.geojson?.type === "Polygon" ? feature.geojson.coordinates?.[0] : null;
    const boundary = Array.isArray(ring)
      ? ring.slice(0, -1).map(([lon, lat]: [number, number]) => [lat, lon] as [number, number])
      : undefined;
    return { ...farm, boundary };
  });
}

export async function deleteFarm(farmId: string) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in to delete a farm.");
  const ownerId = userData.user.id;
  const { data: farm, error: readError } = await (supabase.from("farms" as any) as any)
    .select("id,geo_feature_id").eq("id", farmId).eq("user_id", ownerId).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!farm) throw new Error("Farm not found or access denied.");

  const { error: deleteError } = await (supabase.from("farms" as any) as any)
    .delete().eq("id", farmId).eq("user_id", ownerId);
  if (deleteError) throw new Error(deleteError.message || "Could not delete farm.");

  if (farm.geo_feature_id) {
    await (supabase.from("geo_features" as any) as any).delete()
      .eq("id", farm.geo_feature_id).eq("owner_id", ownerId);
  }
  const { error: boundaryError } = await (supabase.from("geo_features" as any) as any).delete()
    .eq("owner_id", ownerId).eq("feature_type", "farm_boundary")
    .contains("properties", { farm_record_id: String(farmId) });
  if (boundaryError) console.warn("[AgroRisk] Deleted farm but could not remove boundary feature:", boundaryError.message);
}

export type AgroRiskIncidentType = "Flooding" | "Waterlogging" | "Soil Erosion" | "Landslide" | "Drought";

export interface AgroRiskIncidentRecord {
  id: string;
  user_id: string;
  farm_id: string | null;
  lat: number;
  lon: number;
  incident_type: AgroRiskIncidentType;
  description: string;
  status: "unverified";
  source: "user_report";
  reported_at: string;
  created_at: string;
}

export async function saveAgroRiskIncident(input: {
  lat: number;
  lon: number;
  type: AgroRiskIncidentType;
  description: string;
  farmId?: string;
}) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in to submit an incident report.");
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 ||
      !Number.isFinite(input.lon) || input.lon < -180 || input.lon > 180) {
    throw new Error("Incident coordinates are invalid.");
  }
  const description = input.description.trim();
  if (!description || description.length > 2000) throw new Error("Incident description must be 1–2,000 characters.");

  const { data, error } = await (supabase.from("agro_risk_incidents" as any) as any).insert({
    user_id: userData.user.id,
    farm_id: input.farmId ?? null,
    lat: input.lat,
    lon: input.lon,
    incident_type: input.type,
    description,
    status: "unverified",
    source: "user_report",
    reported_at: new Date().toISOString(),
  }).select("*").single();
  if (error) throw new Error(error.message || "Could not save incident report.");
  return data as AgroRiskIncidentRecord;
}

export async function listAgroRiskIncidents(userId?: string): Promise<AgroRiskIncidentRecord[]> {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return [];
  if (userId && userId !== userData.user.id) throw new Error("You can only list your own incident reports.");
  const { data, error } = await (supabase.from("agro_risk_incidents" as any) as any)
    .select("*").eq("user_id", userData.user.id).order("reported_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message || "Could not load incident reports.");
  return (data || []) as AgroRiskIncidentRecord[];
}

export async function deleteAgroRiskIncident(incidentId: string) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in to delete an incident report.");
  const { data, error } = await (supabase.from("agro_risk_incidents" as any) as any)
    .delete().eq("id", incidentId).eq("user_id", userData.user.id).select("id").maybeSingle();
  if (error) throw new Error(error.message || "Could not delete incident report.");
  if (!data) throw new Error("Incident report not found or access denied.");
}
