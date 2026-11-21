import React, { useState, useRef, useEffect } from "react";
import { useDroneState } from "@/hooks/useDroneState";
import { LiveFlightView } from "./LiveFlightView";
import { TelemetryDashboard } from "./TelemetryDashboard";
import { DroneConnectionCenter } from "./DroneConnectionCenter";
import { DroneMissionLocationPanel } from "./DroneMissionLocationPanel";
import { DipaAiAdvisory } from "./DipaAiAdvisory";
import { DipaVision } from "./DipaVision";
import { MissionPlanning } from "./MissionPlanning";
import { DroneMediaCenter } from "./DroneMediaCenter";
import { DroneAnalytics } from "./DroneAnalytics";
import { FleetManagement } from "./FleetManagement";
import { ConnectionProcedure } from "./ConnectionProcedure";
import { ConnectionDiagnostics } from "./ConnectionDiagnostics";
import { FleetThresholdsPanel } from "./FleetThresholdsPanel";
import { useHardwareObservations } from "@/hooks/useHardwareObservations";
import { AircraftRegistry } from "./AircraftRegistry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

export function DroneOperationsConsole() {
  const droneState = useDroneState();
  const { latestByMetric: gatewayTelemetry } = useHardwareObservations(["aerial-console"]);
  const gatewayReadings = [...gatewayTelemetry.values()].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
  const [activeTab, setActiveTab] = useState("mission-control");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await rootRef.current.requestFullscreen().catch(() => {});
  };

  return (
    <div ref={rootRef} className={`bg-slate-950 text-slate-100 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-2xl space-y-4 ${isFullscreen ? "h-screen w-screen overflow-y-auto rounded-none" : ""}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-mono font-bold text-cyan-400 tracking-wider">AERIAL CONTROL</h2>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UNIVERSAL AIR OPERATIONS · POWERED BY DIPA &amp; AIR INTEGRATION HUB</p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="lg:hidden text-slate-400 hover:text-cyan-400 hover:bg-slate-800 shrink-0" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 lg:w-auto">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full lg:w-auto justify-start overflow-x-auto flex-nowrap whitespace-nowrap">
              {["mission-control", "fleet", "registry", "planning", "intelligence", "media", "analytics", "settings"].map((id) => (
                <TabsTrigger key={id} value={id} className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400 uppercase shrink-0">
                  {id.replace("-", " ")}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden lg:inline-flex text-slate-400 hover:text-cyan-400 hover:bg-slate-800 shrink-0" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>


      {gatewayReadings.length > 0 && (
        <section className="rounded-lg border border-cyan-900/60 bg-slate-900/70 p-3 space-y-2" aria-label="Registered aircraft gateway telemetry">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">Registered Device Gateway · Read-only</h3><span className="text-[10px] text-slate-400">Independent of simulator and flight controls</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {gatewayReadings.map((reading) => <div key={reading.metric} className="rounded border border-slate-800 bg-slate-950 p-2"><p className="text-[9px] uppercase text-slate-500">{reading.metric.replaceAll("_", " ")}</p><p className="text-sm font-mono text-cyan-200">{reading.value} {reading.unit}</p><p className="text-[9px] text-slate-500">{new Date(reading.measuredAt).toLocaleTimeString()}</p></div>)}
          </div>
          <p className="text-[10px] text-slate-500">Device-reported measurements are displayed for monitoring only. They do not arm, move, calibrate or otherwise command an aircraft.</p>
        </section>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="mission-control" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4 flex flex-col">
              <DroneConnectionCenter {...droneState} />
              <ConnectionDiagnostics diagnostics={droneState.diagnostics} protocol={droneState.protocol} status={droneState.status} />
              <ConnectionProcedure />
              <DipaAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <LiveFlightView telemetry={droneState.telemetry} status={droneState.status} missionId={droneState.missionId} />
                </div>
                <div>
                  <DroneMissionLocationPanel telemetry={droneState.telemetry} protocol={droneState.protocol} status={droneState.status} lastTelemetryAt={droneState.lastTelemetryAt} droneName={droneState.droneName} />
                </div>
              </div>
              <TelemetryDashboard telemetry={droneState.telemetry as any} environment={droneState.environment} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="m-0"><FleetManagement /></TabsContent>
        <TabsContent value="registry" className="m-0"><AircraftRegistry /></TabsContent>
        <TabsContent value="planning" className="m-0"><MissionPlanning /></TabsContent>

        <TabsContent value="intelligence" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DipaAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            <DipaVision missionId={droneState.missionId} />
          </div>
        </TabsContent>

        <TabsContent value="media" className="m-0"><DroneMediaCenter /></TabsContent>
        <TabsContent value="analytics" className="m-0"><DroneAnalytics /></TabsContent>

        <TabsContent value="settings" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FleetThresholdsPanel />
            <ConnectionDiagnostics diagnostics={droneState.diagnostics} protocol={droneState.protocol} status={droneState.status} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
