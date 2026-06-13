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
import { AircraftRegistry } from "./AircraftRegistry";
import { LiveStreamingConsole } from "./LiveStreamingConsole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, Plane, ShieldCheck, HelpCircle } from "lucide-react";

export function DroneOperationsConsole() {
  const droneState = useDroneState();
  const [activeTab, setActiveTab] = useState("mission-control");
  const isFlying = ["flying", "returning", "paused"].includes(droneState.status);

  return (
    <div className="bg-slate-950 text-slate-100 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-2xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-mono font-bold text-cyan-400 tracking-wider">AERIAL CONTROL</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">DRONE OPERATIONS &amp; AERIAL INTELLIGENCE · POWERED BY ODENEHO AI</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full lg:w-auto justify-start overflow-x-auto">
            {["mission-control", "planning", "registry", "streaming", "intelligence", "media", "analytics", "guide"].map((id) => (
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
              <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <LiveFlightView
                    telemetry={droneState.telemetry}
                    status={droneState.status}
                    missionId={droneState.missionId}
                    onEmergencyLand={droneState.emergencyLand}
                    onReturnToHome={droneState.returnToHome}
                    environment={droneState.environment}
                  />
                </div>
                <div>
                  <AgNavDroneMap telemetry={droneState.telemetry} isFlying={isFlying} />
                </div>
              </div>
              <TelemetryDashboard telemetry={droneState.telemetry as any} environment={droneState.environment} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="planning" className="m-0"><MissionPlanning /></TabsContent>

        <TabsContent value="registry" className="m-0"><AircraftRegistry /></TabsContent>
        <TabsContent value="streaming" className="m-0"><LiveStreamingConsole /></TabsContent>

        <TabsContent value="intelligence" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} status={droneState.status} />
            <OdenehoVision missionId={droneState.missionId} />
          </div>
        </TabsContent>

        <TabsContent value="media" className="m-0"><DroneMediaCenter /></TabsContent>
        <TabsContent value="analytics" className="m-0"><DroneAnalytics /></TabsContent>

        <TabsContent value="guide" className="m-0">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <HelpCircle className="h-5 w-5 text-cyan-400" />
              <h3 className="font-mono font-bold text-sm tracking-wider text-cyan-400">DRONE CONNECTION &amp; OPERATIONS GUIDELINES</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Wi-Fi Guide */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold border-b border-slate-800 pb-2">
                  <Wifi className="h-4 w-4" /> 01. WI-FI DRONE CONNECTION
                </div>
                <ul className="text-[11px] font-mono text-slate-400 space-y-2.5 list-none pl-0">
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">1.</span> Power on the drone aircraft and remote controller.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">2.</span> On your ground station device, scan and connect to the drone's Wi-Fi network (SSID usually formatted as <span className="text-slate-200">Direct-Odeneho-X1</span>).</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">3.</span> Select the <span className="text-slate-200">Wi-Fi Drone</span> protocol from the dropdown inside the Connection Center.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">4.</span> Click <span className="text-slate-200">Connect</span>. Status will switch to READY once socket telemetry is active.</li>
                </ul>
              </div>

              {/* MAVLink / Pixhawk / ArduPilot Guide */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold border-b border-slate-800 pb-2">
                  <Plane className="h-4 w-4" /> 02. MAVLINK / FLIGHT PROTOCOLS
                </div>
                <ul className="text-[11px] font-mono text-slate-400 space-y-2.5 list-none pl-0">
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">1.</span> Attach telemetry radio (915MHz/433MHz) or USB cable to ground station device.</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">2.</span> Ensure companion webapp/bridge is running to pipe serial communications to port <span className="text-slate-200">8088</span> (WebSockets).</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">3.</span> Choose the corresponding protocol (<span className="text-slate-200">MAVLink</span>, <span className="text-slate-200">ArduPilot</span>, or <span className="text-slate-200">Pixhawk</span>).</li>
                  <li className="flex items-start gap-1.5"><span className="text-cyan-500 font-bold">4.</span> Verify parameters sync correctly and GPS fix changes to 3D.</li>
                </ul>
              </div>

              {/* Pre-Flight Checklist */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold border-b border-slate-800 pb-2">
                  <ShieldCheck className="h-4 w-4" /> 03. PRE-FLIGHT CHECKLIST
                </div>
                <ul className="text-[11px] font-mono text-slate-400 space-y-2.5 list-none pl-0">
                  <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-bold">✔</span> check the <span className="text-slate-200">Flight Evaluation</span> tab for current weather and airspace clearance warnings.</li>
                  <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-bold">✔</span> Perform compass calibration by clicking the <span className="text-slate-200">CALIBRATE</span> button.</li>
                  <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-bold">✔</span> Battery charge must be above <span className="text-slate-200">50%</span> before takeoff.</li>
                  <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-bold">✔</span> Ensure the radar is clear and flight path is unobstructed by obstacles.</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
