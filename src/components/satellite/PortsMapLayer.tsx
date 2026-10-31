import { useCallback, useEffect, useRef, useState } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { toast } from "sonner";
import { searchMappedPorts, type PortSearchFeature } from "@/services/satellite/ports";

interface Props {
  enabled: boolean;
  onResults?: (ports: PortSearchFeature[]) => void;
  onSelect?: (port: PortSearchFeature) => void;
}

export function PortsMapLayer({ enabled, onResults, onSelect }: Props) {
  const map = useMap();
  const [ports, setPorts] = useState<PortSearchFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadVisiblePorts = useCallback(async () => {
    requestRef.current?.abort();
    if (!enabled) {
      setPorts([]);
      onResults?.([]);
      setLoading(false);
      return;
    }
    if (map.getZoom() < 7) {
      setPorts([]);
      onResults?.([]);
      setLoading(false);
      return;
    }

    const bounds = map.getBounds();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const result = await searchMappedPorts({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setPorts(result);
      onResults?.(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error("Mapped port layer unavailable", {
          description: error instanceof Error ? error.message : "OpenStreetMap port data could not be loaded.",
        });
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled, map, onResults]);

  useEffect(() => {
    if (!enabled) {
      setPorts([]);
      onResults?.([]);
      return;
    }
    void loadVisiblePorts();
    const queueRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void loadVisiblePorts(); }, 900);
    };
    map.on("moveend", queueRefresh);
    map.on("zoomend", queueRefresh);
    return () => {
      map.off("moveend", queueRefresh);
      map.off("zoomend", queueRefresh);
      if (timerRef.current) clearTimeout(timerRef.current);
      requestRef.current?.abort();
    };
  }, [enabled, loadVisiblePorts, map, onResults]);

  return (
    <>
      {ports.map((port) => (
        <CircleMarker
          key={port.id}
          center={[port.lat, port.lon]}
          radius={7}
          pathOptions={{ color: "#38bdf8", weight: 2, fillColor: "#075985", fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect?.(port) }}
        >
          <Popup>
            <div className="min-w-44 space-y-1 text-xs">
              <div className="font-semibold">{port.name}</div>
              <div className="text-slate-500">OpenStreetMap mapped feature</div>
              <div>{port.tags["seamark:type"] || port.tags.harbour || port.tags.landuse || port.tags.industrial || "Port / harbour feature"}</div>
              <div className="text-amber-700">Operational status, cargo capabilities and customs services are not verified by this map record.</div>
              <div className="text-[10px] text-slate-500">OSM {port.osmType}/{port.osmId}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {enabled && loading ? null : null}
    </>
  );
}
