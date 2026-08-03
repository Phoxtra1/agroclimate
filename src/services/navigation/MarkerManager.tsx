import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LatLng } from "./types";

interface SmoothNavigationMarkerProps {
  position: LatLng;
  bearing: number;
  speedKn: number;
  vesselId: string;
  isSosActive: boolean;
  isBlinking: boolean;
}

const createNavigationPointerIcon = (bearingDeg: number, isSos: boolean, isBlinking: boolean) => {
  const color = isSos ? "#dc2626" : "#3b82f6";
  const glowAnimation = isBlinking ? "animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;" : "";
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);">
        <!-- Pulsing halo -->
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: ${color};
          opacity: 0.3;
          ${glowAnimation}
        "></div>
        <!-- Inner circle -->
        <div style="
          position: relative;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          background-color: ${color};
          box-shadow: 0 0 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Direction arrow -->
          <svg style="
            width: 10px;
            height: 10px;
            color: #ffffff;
            transform: rotate(${bearingDeg}deg);
            transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
          " fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0.8; }
          80%, 100% { transform: scale(1.3); opacity: 0; }
        }
      </style>
    `,
    className: "smooth-navigation-pointer",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

export const SmoothNavigationMarker: React.FC<SmoothNavigationMarkerProps> = ({
  position,
  bearing,
  speedKn,
  vesselId,
  isSosActive,
  isBlinking,
}) => {
  const icon = React.useMemo(() => {
    return createNavigationPointerIcon(bearing, isSosActive, isBlinking || isSosActive);
  }, [bearing, isSosActive, isBlinking]);

  return (
    <Marker position={[position.lat, position.lon]} icon={icon}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-bold">You · {vesselId}</p>
          <p>Speed: {speedKn.toFixed(1)} knots</p>
          <p>Bearing: {bearing.toFixed(0)}°</p>
          <p className="text-muted-foreground font-mono">
            {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

interface SmoothDestinationMarkerProps {
  position: LatLng;
  label: string;
}

export const SmoothDestinationMarker: React.FC<SmoothDestinationMarkerProps> = ({
  position,
  label,
}) => {
  return (
    <Marker position={[position.lat, position.lon]}>
      <Popup>
        <div className="text-xs">
          <p className="font-bold">Destination</p>
          <p className="text-muted-foreground leading-tight">{label}</p>
          <p className="font-mono text-[10px] mt-1 text-primary">
            {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};
