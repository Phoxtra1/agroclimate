import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clock, MapPin, Plane, Radio, Satellite, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";
import type { DroneProtocol, DroneTelemetry, FlightStatus } from "@/lib/drone/types";

interface Props {
  telemetry: DroneTelemetry;
  protocol: DroneProtocol;
  status: FlightStatus;
  lastTelemetryAt: number | null;
  droneName: string;
}

export function DroneMissionLocationPanel({ telemetry, protocol, status, lastTelemetryAt, droneName }: Props) {
  const ageSeconds = lastTelemetryAt === null ? Number.POSITIVE_INFINITY : Math.max(0, Math.round((Date.now() - lastTelemetryAt) / 1000));
  const hasCoordinates = Number.isFinite(telemetry.lat) && Number.isFinite(telemetry.lng)
    && telemetry.lat !== undefined && telemetry.lng !== undefined
    && telemetry.lat >= -90 && telemetry.lat <= 90
    && telemetry.lng >= -180 && telemetry.lng <= 180;
  const gpsQualityGood = telemetry.gpsFix !== "none" && Number.isFinite(telemetry.gpsAccuracy)
    && telemetry.gpsAccuracy > 0 && telemetry.gpsAccuracy <= 50;
  const liveVerifiedFix = protocol !== "simulator"
    && status !== "disconnected" && status !== "connecting"
    && lastTelemetryAt !== null && ageSeconds <= 15
    && hasCoordinates && gpsQualityGood;

  const stateLabel = useMemo(() => {
    if (protocol === "simulator") return "SIMULATOR · NOT A LIVE AIRCRAFT POSITION";
    if (status === "disconnected") return "AIRCRAFT DISCONNECTED";
    if (lastTelemetryAt === null) return "WAITING FOR TELEMETRY";
    if (ageSeconds > 15) return "TELEMETRY STALE";
    if (!hasCoordinates || !gpsQualityGood) return "NO VERIFIED GPS FIX";
    return "GPS TELEMETRY RECEIVED";
  }, [protocol, status, lastTelemetryAt, ageSeconds, hasCoordinates, gpsQualityGood]);

  return (
    <Card className="border-slate-800 bg-slate-950 text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-mono">
          <Satellite className="h-4 w-4 text-cyan-300" /> MISSION LOCATION · SHARED SATELLITE
          <Badge variant="outline" className="ml-auto border-slate-700 text-[9px]">{stateLabel}</Badge>
        </CardTitle>
        <p className="text-[10px] text-slate-400">{droneName} · {protocol.toUpperCase()} · {status.toUpperCase()}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasCoordinates ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-slate-800 bg-slate-900 p-2">
              <div className="text-[9px] text-slate-500">Latitude</div>
              <div className="font-mono text-xs">{telemetry.lat!.toFixed(6)}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900 p-2">
              <div className="text-[9px] text-slate-500">Longitude</div>
              <div className="font-mono text-xs">{telemetry.lng!.toFixed(6)}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900 p-2">
              <div className="text-[9px] text-slate-500">GPS accuracy</div>
              <div className="font-mono text-xs">{telemetry.gpsAccuracy > 0 ? `±${Math.round(telemetry.gpsAccuracy)} m` : "Not supplied"}</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900 p-2">
              <div className="text-[9px] text-slate-500">Last telemetry frame</div>
              <div className="font-mono text-xs">{lastTelemetryAt === null ? "Unknown" : `${ageSeconds}s ago`}</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">The aircraft adapter has not supplied coordinates.</p>
        )}
        {liveVerifiedFix ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fresh device telemetry with a 2D/3D GPS fix and accuracy at or below 50 m.
            </div>
            <OpenInSatelliteButton
              lat={telemetry.lat!}
              lon={telemetry.lng!}
              label={`Live aircraft telemetry · ${droneName}`}
              zoom={18}
              className="w-full"
            >
              Inspect aircraft position in Satellite
            </OpenInSatelliteButton>
          </div>
        ) : (
          <div className="rounded border border-amber-800/50 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100">
            <div className="mb-1 flex items-center gap-1 font-semibold"><AlertCircle className="h-3.5 w-3.5" /> Position not verified as live</div>
            {protocol === "simulator"
              ? "The built-in simulator may generate example coordinates. They are not shown as a real aircraft position on Satellite."
              : status === "disconnected"
                ? "Connect to the aircraft to receive a fresh telemetry frame."
                : ageSeconds > 15
                  ? "The last telemetry frame is more than 15 seconds old. Reconnect or wait for fresh device telemetry."
                  : "A valid GPS fix and current coordinates with acceptable reported accuracy are required before sending this position to Satellite."}
          </div>
        )}
        <p className="text-[9px] text-slate-500">Map link is enabled only for non-simulator telemetry received within 15 seconds, with an explicit GPS fix and reported accuracy ≤50 m. This is a data-quality check, not aviation clearance.</p>
      </CardContent>
    </Card>
  );
}
