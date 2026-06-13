import { supabase } from "@/integrations/supabase/client";
import { ConnectionAdapter, ConnectionDiagnostics, DiscoveredDrone, DroneTelemetry, FlightStatus } from "./types";

// AIH (Air Integration Hub) adapter — brokers all aircraft commands through
// the `aih-gateway` edge function. The function returns a Universal
// Telemetry Gateway (UTG) envelope plus realtime command acknowledgements.
export function createAihAdapter(): ConnectionAdapter {
  let status: FlightStatus = "disconnected";
  let telemetry: DroneTelemetry = {
    altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0,
    battery: 100, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
    flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
  };
  let diag: ConnectionDiagnostics = { transport: "aih", framesReceived: 0, bytesReceived: 0 };
  const tListeners = new Set<(t: DroneTelemetry) => void>();
  const sListeners = new Set<(s: FlightStatus) => void>();
  const dListeners = new Set<(d: ConnectionDiagnostics) => void>();
  const emit = () => tListeners.forEach((cb) => cb({ ...telemetry }));
  const emitDiag = () => dListeners.forEach((cb) => cb({ ...diag }));
  const setStatus = (s: FlightStatus) => { status = s; sListeners.forEach((cb) => cb(s)); };
  let activeId: string | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;

  const call = async (action: string, body: any = {}) => {
    const { data, error } = await supabase.functions.invoke("aih-gateway", {
      body: { action, aircraftId: activeId, ...body },
    });
    if (error) { diag.lastError = error.message; emitDiag(); throw error; }
    diag.lastHandshakeAt = Date.now(); diag.lastError = undefined;
    if (data?.telemetry) {
      const u = data.telemetry;
      telemetry = { ...telemetry, ...u };
      diag.lastFrameAt = Date.now(); diag.framesReceived += 1;
      diag.bytesReceived += JSON.stringify(u).length;
      emit();
    }
    emitDiag();
    return data;
  };

  return {
    id: "aih",
    label: "Air Integration Hub",

    async scan() {
      diag.endpoint = "aih-gateway"; emitDiag();
      const data = await call("discover");
      return (data?.aircraft || []) as DiscoveredDrone[];
    },

    async connect(droneId: string) {
      setStatus("connecting");
      activeId = droneId;
      try {
        await call("connect");
        setStatus("connected");
        if (poll) clearInterval(poll);
        poll = setInterval(() => { call("telemetry").catch(() => {}); }, 1500);
      } catch (e) { setStatus("disconnected"); throw e; }
    },

    async disconnect() {
      if (poll) { clearInterval(poll); poll = null; }
      try { await call("disconnect"); } catch {}
      activeId = null;
      diag = { transport: "aih", framesReceived: 0, bytesReceived: 0 };
      emitDiag();
      setStatus("disconnected");
    },

    async calibrate()     { await call("calibrate"); setStatus("connected"); },
    async arm()           { await call("arm"); setStatus("armed"); },
    async startMission()  { await call("takeoff"); setStatus("flying"); },
    async pauseMission()  { await call("hold"); setStatus("paused"); },
    async resumeMission() { await call("resume"); setStatus("flying"); },
    async returnToHome()  { await call("rth"); setStatus("returning"); },
    async emergencyLand() { await call("land"); setStatus("emergency"); },

    onTelemetry(cb)   { tListeners.add(cb); cb({ ...telemetry }); return () => { tListeners.delete(cb); }; },
    onStatus(cb)      { sListeners.add(cb); cb(status); return () => { sListeners.delete(cb); }; },
    onDiagnostics(cb) { dListeners.add(cb); cb({ ...diag }); return () => { dListeners.delete(cb); }; },
    getDiagnostics()  { return { ...diag }; },
  };
}
