import { ConnectionAdapter, DiscoveredDrone, DroneTelemetry, FlightStatus } from "./types";

export function createSimulatorAdapter(): ConnectionAdapter {
  let status: FlightStatus = "disconnected";
  let telemetry: DroneTelemetry = {
    lat: 5.6037, lng: -0.1870, altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0,
    battery: 100, signalStrength: 0, gpsAccuracy: 5, gpsFix: "none",
    flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
  };
  const tListeners = new Set<(t: DroneTelemetry) => void>();
  const sListeners = new Set<(s: FlightStatus) => void>();
  let interval: ReturnType<typeof setInterval> | null = null;

  const emit = () => tListeners.forEach((cb) => cb({ ...telemetry }));
  const setStatus = (s: FlightStatus) => { status = s; sListeners.forEach((cb) => cb(s)); };

  const startTick = () => {
    if (interval) return;
    interval = setInterval(() => {
      const flying = status === "flying" || status === "returning";
      if (flying) {
        telemetry.altitude = Math.max(0, telemetry.altitude + (status === "returning" ? -0.5 : (Math.random() * 0.6 - 0.2)));
        telemetry.groundSpeed = status === "returning" ? 14 : 10 + Math.random() * 4;
        telemetry.verticalSpeed = status === "returning" ? -1 : Math.random() * 0.3 - 0.15;
        telemetry.heading = (telemetry.heading + (Math.random() * 4 - 2) + 360) % 360;
        telemetry.battery = Math.max(0, telemetry.battery - 0.04);
        telemetry.distanceCovered += telemetry.groundSpeed * 0.5;
        telemetry.flightDuration += 0.5;
        telemetry.lat = (telemetry.lat || 0) + (Math.random() - 0.5) * 0.00005;
        telemetry.lng = (telemetry.lng || 0) + (Math.random() - 0.5) * 0.00005;
        if (status === "returning" && telemetry.altitude < 1) setStatus("connected");
      }
      if (status !== "disconnected") {
        telemetry.signalStrength = 85 + Math.random() * 10;
        telemetry.gpsAccuracy = 0.4 + Math.random() * 0.4;
        telemetry.gpsFix = "3d";
      }
      emit();
    }, 500);
  };

  return {
    id: "simulator",
    label: "Built-in Simulator",
    async scan(): Promise<DiscoveredDrone[]> {
      await new Promise((r) => setTimeout(r, 600));
      return [
        { id: "sim-x1", name: "Odeneho Sim-X1", model: "Simulated Quad", protocol: "simulator", signal: 98, firmware: "sim-1.0" },
        { id: "sim-x2", name: "Odeneho Sim-X2", model: "Simulated Hex", protocol: "simulator", signal: 92, firmware: "sim-1.0" },
      ];
    },
    async connect() {
      setStatus("connecting");
      await new Promise((r) => setTimeout(r, 900));
      telemetry.cameraStatus = "ready";
      telemetry.gpsFix = "3d";
      setStatus("connected");
      startTick();
    },
    async disconnect() {
      if (interval) { clearInterval(interval); interval = null; }
      telemetry = { ...telemetry, altitude: 0, groundSpeed: 0, flightDuration: 0, distanceCovered: 0, cameraStatus: "off", gpsFix: "none" };
      setStatus("disconnected");
    },
    async calibrate() {
      setStatus("calibrating");
      await new Promise((r) => setTimeout(r, 1200));
      setStatus("connected");
    },
    async arm() { setStatus("armed"); },
    async startMission() {
      telemetry.cameraStatus = "recording";
      telemetry.altitude = 2;
      setStatus("flying");
    },
    async pauseMission() { if (status === "flying") setStatus("paused"); },
    async resumeMission() { if (status === "paused") setStatus("flying"); },
    async returnToHome() { setStatus("returning"); },
    async emergencyLand() {
      setStatus("emergency");
      await new Promise((r) => setTimeout(r, 1500));
      telemetry.altitude = 0;
      setStatus("connected");
    },
    onTelemetry(cb) { tListeners.add(cb); cb({ ...telemetry }); return () => tListeners.delete(cb); },
    onStatus(cb) { sListeners.add(cb); cb(status); return () => sListeners.delete(cb); },
  };
}
