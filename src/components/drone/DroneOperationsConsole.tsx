import React, { useState } from "react";
import { useDroneState } from "@/hooks/useDroneState";
import { LiveFlightView } from "./LiveFlightView";
import { TelemetryDashboard } from "./TelemetryDashboard";
import { DroneConnectionCenter } from "./DroneConnectionCenter";
import { AgNavDroneMap } from "./AgNavDroneMap";
import { OdenehoAiAdvisory } from "./OdenehoAiAdvisory";
import { OdenehoVision } from "./OdenehoVision";
import { MissionPlanning } from "./MissionPlanning";
import { DroneMediaCenter } from "./DroneMediaCenter";
import { DroneAnalytics } from "./DroneAnalytics";
import { FleetManagement } from "./FleetManagement";
import { ConnectionProcedure } from "./ConnectionProcedure";
import { ConnectionDiagnostics } from "./ConnectionDiagnostics";
import { FleetThresholdsPanel } from "./FleetThresholdsPanel";
import { AircraftRegistry } from "./AircraftRegistry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DroneOperationsConsole() {
  const droneState = useDroneState();
  const [activeTab, setActiveTab] = useState("mission-control");
  const isFlying = ["flying", "returning", "paused"].includes(droneState.status);

  return (
    <div className="bg-slate-950 text-slate-100 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-2xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-mono font-bold text-cyan-400 tracking-wider">AERIAL CONTROL</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UNIVERSAL AIR OPERATIONS · POWERED BY ODENEHO AI &amp; AIR INTEGRATION HUB</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full lg:w-auto justify-start overflow-x-auto">
            {["mission-control", "fleet", "registry", "planning", "intelligence", "media", "analytics", "settings"].map((id) => (
              <TabsTrigger key={id} value={id} className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400 uppercase">
                {id.replace("-", " ")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="mission-control" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-4 flex flex-col">
              <DroneConnectionCenter {...droneState} />
              <ConnectionDiagnostics diagnostics={droneState.diagnostics} protocol={droneState.protocol} status={droneState.status} />
              <ConnectionProcedure />
              <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <LiveFlightView telemetry={droneState.telemetry} status={droneState.status} missionId={droneState.missionId} />
                </div>
                <div>
                  <AgNavDroneMap telemetry={droneState.telemetry} isFlying={isFlying} />
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
            <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            <OdenehoVision missionId={droneState.missionId} />
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
