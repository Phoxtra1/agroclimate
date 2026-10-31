import { useEffect, useMemo } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { StationNode } from "@/services/satellite/stations";
import type { RouteData } from "@/services/satellite/navigation";

// Smooth FlyTo controller
export function MapCameraController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom ?? Math.max(7, map.getZoom()), {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [center, zoom, map]);
  return null;
}

// Fit bounds controller for routing
export function RouteBoundsController({ route }: { route: RouteData | null }) {
  const map = useMap();
  useEffect(() => {
    if (!route || !route.geometry.length) return;
    const bounds = L.latLngBounds(route.geometry.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 1.0 });
  }, [route, map]);
  return null;
}

// Create custom HUD DivIcon matching the screenshot exactly
export function createStationHudIcon(station: StationNode, isSelected: boolean) {
  const isAwaiting = station.status === "awaiting";
  const deltaColor =
    station.deltaType === "up" ? "#10b981" : station.deltaType === "down" ? "#f43f5e" : "#94a3b8";

  const borderColor = isSelected
    ? "#f59e0b"
    : station.status === "stale"
    ? "#d97706"
    : "rgba(56, 189, 248, 0.45)";

  const glowShadow = isSelected
    ? "0 0 16px rgba(245, 158, 11, 0.6)"
    : "0 4px 14px rgba(0, 0, 0, 0.75)";

  const html = `
    <div style="
      position: relative;
      transform: translate(-50%, -100%);
      margin-top: -10px;
      background: rgba(10, 16, 29, 0.94);
      backdrop-filter: blur(8px);
      border: 1px solid ${borderColor};
      border-radius: 6px;
      padding: 6px 10px;
      color: #f1f5f9;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      min-width: 140px;
      max-width: 220px;
      box-shadow: ${glowShadow};
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.2s ease;
    ">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 6px; line-height: 1.2;">
        <span style="font-weight: 700; font-size: 11px; color: ${isAwaiting ? '#94a3b8' : '#f8fafc'};">
          ${station.metricLabel}
        </span>
        ${
          !isAwaiting && station.delta !== "—"
            ? `<span style="font-size: 10px; color: ${deltaColor}; white-space: nowrap;">${station.delta}</span>`
            : ""
        }
      </div>
      <div style="font-family: inherit; font-size: 11px; font-weight: 600; color: #cbd5e1; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${station.name}
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #64748b; margin-top: 2px;">
        <span style="color: #38bdf8;">${station.sensor} · ${station.sensorDate}</span>
        ${
          station.statusText
            ? `<span style="color: #f59e0b; font-weight: 600;">${station.statusText}</span>`
            : ""
        }
      </div>
      <!-- anchor pin needle -->
      <div style="
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid ${borderColor};
      "></div>
      <div style="
        position: absolute;
        bottom: -11px;
        left: 50%;
        transform: translateX(-50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${isSelected ? '#f59e0b' : '#38bdf8'};
        box-shadow: 0 0 6px ${isSelected ? '#f59e0b' : '#38bdf8'};
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "strategic-hud-pin",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// Vehicle Marker Icon for simulated real-time navigation
export function createVehicleNavIcon(headingDeg: number = 0) {
  const html = `
    <div style="
      position: relative;
      transform: translate(-50%, -50%);
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.25);
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #10b981;
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px #10b981;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${headingDeg}deg);
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
          <polygon points="12,2 22,22 12,17 2,22" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    className: "nav-vehicle-beacon",
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Origin / Destination Pin Icons
export function createRoutePinIcon(type: "origin" | "destination") {
  const isStart = type === "origin";
  const bg = isStart ? "#3b82f6" : "#ef4444";
  const label = isStart ? "A" : "B";

  const html = `
    <div style="
      transform: translate(-50%, -100%);
      width: 26px;
      height: 34px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${bg};
        border: 2px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 800;
          font-size: 11px;
          font-family: sans-serif;
        ">${label}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: `route-pin-${type}`,
    html,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  });
}

// Waypoint node marker for corridor
const corridorNodeIcon = L.divIcon({
  className: "corridor-node",
  html: `<div style="
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid rgba(56, 189, 248, 0.9);
    background: #0b1329;
    box-shadow: 0 0 5px rgba(56, 189, 248, 0.6);
  "></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

export function StrategicCorridorOverlay({
  corridorLine,
  stations,
  selectedStationId,
  onSelectStation,
}: {
  corridorLine: [number, number][];
  stations: StationNode[];
  selectedStationId: string;
  onSelectStation: (station: StationNode) => void;
}) {
  return (
    <>
      {/* Dashed corridor lane line */}
      {corridorLine.length > 1 && (
        <>
          {/* Subtle glow underlay */}
          <Polyline
            positions={corridorLine}
            pathOptions={{
              color: "#0284c7",
              weight: 5,
              opacity: 0.35,
              lineCap: "round",
            }}
          />
          {/* Primary dashed line */}
          <Polyline
            positions={corridorLine}
            pathOptions={{
              color: "#38bdf8",
              weight: 2,
              opacity: 0.85,
              dashArray: "6 8",
            }}
          />
          {/* Node dots along line */}
          {corridorLine.map((pt, idx) => (
            <Marker key={`node-${idx}`} position={pt} icon={corridorNodeIcon} interactive={false} />
          ))}
        </>
      )}

      {/* Floating HUD station markers */}
      {stations.map((station) => {
        const isSelected = station.id === selectedStationId;
        const icon = createStationHudIcon(station, isSelected);

        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lon]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectStation(station),
            }}
          >
            <Popup className="dark-satellite-popup" offset={[0, -20]}>
              <div className="p-1 text-slate-100 font-mono text-xs">
                <p className="font-bold text-sky-400">{station.name}</p>
                <p className="text-[11px] text-slate-300">{station.subLabel}</p>
                <div className="mt-1 flex items-center justify-between border-t border-slate-700 pt-1 text-[10px]">
                  <span>{station.metricLabel}</span>
                  <span className={station.deltaType === "up" ? "text-emerald-400" : "text-rose-400"}>
                    {station.delta}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// Navigation Route Polyline Overlay
export function NavigationRouteOverlay({
  route,
  startPoint,
  endPoint,
  simulatedPosition,
  simulatedHeading,
}: {
  route: RouteData | null;
  startPoint: [number, number] | null;
  endPoint: [number, number] | null;
  simulatedPosition: [number, number] | null;
  simulatedHeading?: number;
}) {
  const originIcon = useMemo(() => createRoutePinIcon("origin"), []);
  const destIcon = useMemo(() => createRoutePinIcon("destination"), []);
  const vehicleIcon = useMemo(
    () => (simulatedPosition ? createVehicleNavIcon(simulatedHeading ?? 0) : null),
    [simulatedPosition, simulatedHeading]
  );

  if (!route && !startPoint && !endPoint) return null;

  return (
    <>
      {/* Route Glow Underlay */}
      {route && route.geometry.length > 1 && (
        <>
          <Polyline
            positions={route.geometry}
            pathOptions={{
              color: "#059669",
              weight: 8,
              opacity: 0.35,
              lineCap: "round",
            }}
          />
          {/* Main navigable polyline */}
          <Polyline
            positions={route.geometry}
            pathOptions={{
              color: "#10b981",
              weight: 4,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}

      {/* Origin Marker */}
      {startPoint && <Marker position={startPoint} icon={originIcon} />}

      {/* Destination Marker */}
      {endPoint && <Marker position={endPoint} icon={destIcon} />}

      {/* Animated Vehicle in Simulation mode */}
      {simulatedPosition && vehicleIcon && (
        <Marker position={simulatedPosition} icon={vehicleIcon} />
      )}
    </>
  );
}
