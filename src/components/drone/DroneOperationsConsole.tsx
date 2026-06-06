import React, { useState } from 'react';
import { useDroneState } from '@/hooks/useDroneState';
import { LiveFlightView } from './LiveFlightView';
import { TelemetryDashboard } from './TelemetryDashboard';
import { DroneConnectionCenter } from './DroneConnectionCenter';
import { AgNavDroneMap } from './AgNavDroneMap';
import { OdenehoAiAdvisory } from './OdenehoAiAdvisory';
import { OdenehoVision } from './OdenehoVision';
import { MissionPlanning } from './MissionPlanning';
import { DroneMediaCenter } from './DroneMediaCenter';
import { DroneAnalytics } from './DroneAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function DroneOperationsConsole() {
  const droneState = useDroneState();
  const [activeTab, setActiveTab] = useState('mission-control');

  return (
    <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-2xl space-y-4">
      {/* Top Navigation / Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold text-cyan-400 tracking-wider">ODENEHO MISSION CONTROL</h2>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">AERIAL INTELLIGENCE CENTER</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full lg:w-auto justify-start overflow-x-auto">
            <TabsTrigger value="mission-control" className="font-mono text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">MISSION CONTROL</TabsTrigger>
            <TabsTrigger value="planning" className="font-mono text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">PLANNING</TabsTrigger>
            <TabsTrigger value="intelligence" className="font-mono text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">INTELLIGENCE</TabsTrigger>
            <TabsTrigger value="media" className="font-mono text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">MEDIA</TabsTrigger>
            <TabsTrigger value="analytics" className="font-mono text-xs data-[state=active]:bg-cyan-900/50 data-[state=active]:text-cyan-400">ANALYTICS</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        
        <TabsContent value="mission-control" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* Left Column: Connections & Intel */}
            <div className="lg:col-span-1 space-y-4 flex flex-col">
              <DroneConnectionCenter {...droneState} />
              <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} />
            </div>

            {/* Middle Column: Live Video & Map */}
            <div className="lg:col-span-3 space-y-4">
              <LiveFlightView telemetry={droneState.telemetry} status={droneState.status} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <TelemetryDashboard telemetry={droneState.telemetry} environment={droneState.environment} />
                </div>
                <div className="lg:col-span-1">
                  <AgNavDroneMap telemetry={droneState.telemetry} isFlying={droneState.status === 'flying' || droneState.status === 'returning'} />
                </div>
              </div>
            </div>
            
          </div>
        </TabsContent>

        <TabsContent value="planning" className="m-0">
          <MissionPlanning />
        </TabsContent>

        <TabsContent value="intelligence" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OdenehoAiAdvisory telemetry={droneState.telemetry} environment={droneState.environment} />
            <OdenehoVision />
          </div>
        </TabsContent>

        <TabsContent value="media" className="m-0">
          <DroneMediaCenter />
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <DroneAnalytics />
        </TabsContent>

      </Tabs>

    </div>
  );
}
