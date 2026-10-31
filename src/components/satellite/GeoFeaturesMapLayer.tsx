import { useCallback, useEffect, useState } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { toast } from "sonner";
import { listGeoFeatures, type GeoFeatureRecord } from "@/services/satellite/geospatial";
import type { GeoPoint } from "@/services/satellite/navigation";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onSelect?: (point: GeoPoint, label: string) => void;
}

const featureColors: Record<string, string> = {
  warehouse: "#f59e0b",
  silo: "#d97706",
  cold_store: "#38bdf8",
  collection_centre: "#22c55e",
  processing_facility: "#a78bfa",
  buyer: "#f472b6",
  supplier: "#34d399",
  port: "#0ea5e9",
  pickup_point: "#60a5fa",
  delivery_point: "#fb7185",
  water_source: "#06b6d4",
  road_hazard: "#f97316",
  drone_observation: "#a3e635",
  other: "#94a3b8",
};

export function GeoFeaturesMapLayer({ onSelect }: Props) {
  const [features, setFeatures] = useState<GeoFeatureRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const records = await listGeoFeatures({ limit: 400 });
      setFeatures(records);
    } catch (error) {
      toast.error("Shared geospatial records unavailable", {
        description: error instanceof Error ? error.message : "Could not load saved map records.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const channel = supabase.channel("agroclimate-shared-geo-features")
      .on("postgres_changes", { event: "*", schema: "public", table: "geo_features" }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  const pointRecords = features.filter((feature) => feature.geojson?.type === "Point");
  return (
    <>
      {pointRecords.map((feature) => {
        const coordinates = (feature.geojson as GeoJSON.Point).coordinates;
        const lon = Number(coordinates[0]);
        const lat = Number(coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const color = featureColors[feature.feature_type] || "#94a3b8";
        return (
          <CircleMarker
            key={feature.id}
            center={[lat, lon]}
            radius={7}
            pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.85 }}
            eventHandlers={{ click: () => onSelect?.({ lat, lon }, feature.name) }}
          >
            <Popup>
              <div className="min-w-44 space-y-1 text-xs">
                <div className="font-semibold">{feature.name}</div>
                <div className="capitalize">{feature.feature_type.replaceAll("_", " ")}</div>
                <div>Record quality: {feature.data_quality}</div>
                <div>Visibility: {feature.visibility}</div>
                {feature.source_name && <div>Source: {feature.source_name}</div>}
                {feature.acquisition_date && <div>Observed: {new Date(feature.acquisition_date).toLocaleString()}</div>}
                {feature.confidence !== null && <div>Confidence metadata: {(feature.confidence * 100).toFixed(0)}%</div>}
                <div className="text-[10px] text-slate-500">Updated {new Date(feature.updated_at).toLocaleString()}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      {loading ? null : null}
    </>
  );
}
