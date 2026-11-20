import { TelemetryGateway } from "@/services/aih/telemetryGateway";
import { WebSerialMavlinkAdapter } from "@/services/hardware/browserAdapters";
import type { DeviceRegistration } from "@/services/hardware/types";
import type { ConnectionAdapter, ConnectionDiagnostics, DiscoveredDrone, DroneTelemetry, FlightStatus } from "./types";

/**
 * Bridges the existing read-only MAVLink serial decoder into the Aerial
 * Console's ConnectionAdapter contract. No flight commands are transmitted.
 */
export function createMavlinkConnectionAdapter(): ConnectionAdapter {
  const deviceId = "aerial-console:mavlink:browser-serial";
  const device: DeviceRegistration = {
    deviceId,
    tenantId: "local-session",
    ownerUserId: "local-session",
    component: "aerial-console",
    deviceClass: "MAVLink serial telemetry source",
    manufacturer: "Generic MAVLink",
    model: "MAVLink v1/v2",
    protocol: "mavlink",
    capabilities: ["aircraft-telemetry"],
    registeredAt: new Date().toISOString(),
    state: "registered",
  };
  const decoder = new WebSerialMavlinkAdapter({
    onObservation: () => undefined,
  });
  let status: FlightStatus = "disconnected";
  let telemetry: DroneTelemetry = {
    altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0,
    battery: 0, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
    flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
  };
  let diagnostics: ConnectionDiagnostics = { transport: "serial", framesReceived: 0, bytesReceived: 0 };
  let unsubscribeGateway: (() => void) | null = null;
  const telemetryListeners = new Set<(value: DroneTelemetry) => void>();
  const statusListeners = new Set<(value: FlightStatus) => void>();
  const diagnosticsListeners = new Set<(value: ConnectionDiagnostics) => void>();
  const emitTelemetry = () => telemetryListeners.forEach((listener) => listener({ ...telemetry }));
  const setStatus = (next: FlightStatus) => {
    status = next;
    statusListeners.forEach((listener) => listener(next));
  };
  const emitDiagnostics = () => diagnosticsListeners.forEach((listener) => listener({ ...diagnostics }));
  const unsupported = async (): Promise<never> => {
    throw new Error("MAVLink connection is read-only in this browser integration. Flight commands are not sent.");
  };

  return {
    id: "mavlink",
    label: "MAVLink Serial (read-only)",
    async scan(): Promise<DiscoveredDrone[]> {
      if (!("serial" in navigator)) return [];
      return [{
        id: deviceId,
        name: "USB MAVLink telemetry source",
        model: "MAVLink v1/v2 · read-only",
        protocol: "mavlink",
        signal: 0,
        manufacturer: "Generic MAVLink",
      }];
    },
    async connect() {
      if (!window.isSecureContext) throw new Error("MAVLink USB serial requires HTTPS or localhost.");
      if (status === "connected") return;
      setStatus("connecting");
      try {
        const result = await decoder.connect(device);
        if (!result.connected) throw new Error(result.detail || "Could not open the MAVLink serial connection.");
        unsubscribeGateway?.();
        unsubscribeGateway = TelemetryGateway.subscribe(deviceId, (next) => {
          const hasGps = next.gpsStatus !== "none";
          telemetry = {
            ...telemetry,
            ...(hasGps ? { lat: next.latitude, lng: next.longitude } : {}),
            altitude: Number.isFinite(next.altitude) ? next.altitude : telemetry.altitude,
            groundSpeed: Number.isFinite(next.speed) ? next.speed : telemetry.groundSpeed,
            heading: Number.isFinite(next.heading) ? next.heading : telemetry.heading,
            battery: Number.isFinite(next.batteryFuelStatus) ? next.batteryFuelStatus : telemetry.battery,
            signalStrength: Number.isFinite(next.signalStrength) ? next.signalStrength : telemetry.signalStrength,
            gpsFix: next.gpsStatus === "none" ? telemetry.gpsFix : next.gpsStatus === "2d" ? "2d" : "3d",
          };
          diagnostics = {
            ...diagnostics,
            lastFrameAt: Date.now(),
            framesReceived: diagnostics.framesReceived + 1,
          };
          setStatus(next.connectionStatus === "disconnected" ? "disconnected" : "connected");
          emitTelemetry();
          emitDiagnostics();
        });
        diagnostics = { transport: "serial", connectedAt: Date.now(), lastHandshakeAt: Date.now(), framesReceived: 0, bytesReceived: 0 };
        setStatus("connected");
        emitDiagnostics();
      } catch (error) {
        setStatus("disconnected");
        diagnostics = { transport: "serial", framesReceived: 0, bytesReceived: 0, lastError: error instanceof Error ? error.message : "MAVLink connection failed" };
        emitDiagnostics();
        throw error;
      }
    },
    async disconnect() {
      unsubscribeGateway?.();
      unsubscribeGateway = null;
      await decoder.disconnect(deviceId);
      telemetry = {
        altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0,
        battery: 0, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
        flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
      };
      diagnostics = { transport: "none", framesReceived: 0, bytesReceived: 0 };
      emitTelemetry();
      emitDiagnostics();
      setStatus("disconnected");
    },
    calibrate: unsupported,
    arm: unsupported,
    startMission: unsupported,
    pauseMission: unsupported,
    resumeMission: unsupported,
    returnToHome: unsupported,
    emergencyLand: unsupported,
    onTelemetry(listener) { telemetryListeners.add(listener); listener({ ...telemetry }); return () => telemetryListeners.delete(listener); },
    onStatus(listener) { statusListeners.add(listener); listener(status); return () => statusListeners.delete(listener); },
    getDiagnostics() { return { ...diagnostics }; },
    onDiagnostics(listener) { diagnosticsListeners.add(listener); listener({ ...diagnostics }); return () => diagnosticsListeners.delete(listener); },
  };
}
