import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, PlaneTakeoff, ShieldAlert, Navigation, Home } from 'lucide-react';
import { DroneStatus } from '@/hooks/useDroneState';

interface DroneConnectionCenterProps {
  status: DroneStatus;
  droneName: string;
  connect: () => void;
  disconnect: () => void;
  startMission: () => void;
  returnToHome: () => void;
  emergencyLand: () => void;
}

export function DroneConnectionCenter({ 
  status, droneName, connect, disconnect, startMission, returnToHome, emergencyLand 
}: DroneConnectionCenterProps) {
  
  const getStatusBadge = () => {
    switch(status) {
      case 'disconnected': return <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">Offline</Badge>;
      case 'connecting': return <Badge variant="outline" className="bg-amber-900/30 text-amber-400 border-amber-700 animate-pulse">Connecting...</Badge>;
      case 'connected': return <Badge variant="outline" className="bg-emerald-900/30 text-emerald-400 border-emerald-700">Ready</Badge>;
      case 'flying': return <Badge variant="outline" className="bg-cyan-900/30 text-cyan-400 border-cyan-700 animate-pulse">In Flight</Badge>;
      case 'returning': return <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-700">Returning</Badge>;
      case 'emergency': return <Badge variant="destructive" className="animate-pulse">Emergency</Badge>;
      default: return null;
    }
  };

  const isConnected = status !== 'disconnected' && status !== 'connecting';
  const isFlying = status === 'flying' || status === 'returning';

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 h-full">
      <CardHeader className="py-4 border-b border-slate-800 flex flex-row justify-between items-center">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Wifi className="h-4 w-4" /> Connection Center
        </CardTitle>
        {getStatusBadge()}
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        
        {/* Device Info */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-mono font-bold text-lg text-cyan-400">{droneName}</h3>
              <p className="text-xs text-slate-500 font-mono">MAVLink / ArduPilot / System</p>
            </div>
            <Wifi className={`h-5 w-5 ${isConnected ? 'text-emerald-500' : 'text-slate-600'}`} />
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="text-slate-500">FIRMWARE: <span className="text-slate-300">v4.3.1</span></div>
            <div className="text-slate-500">PROTOCOL: <span className="text-slate-300">UDP</span></div>
            <div className="text-slate-500">PORT: <span className="text-slate-300">14550</span></div>
            <div className="text-slate-500">PING: <span className="text-slate-300">{isConnected ? '24ms' : '--'}</span></div>
          </div>
        </div>

        {/* Connection Controls */}
        <div className="space-y-3">
          <p className="text-xs font-mono text-slate-500 uppercase">System Power</p>
          {!isConnected ? (
            <Button 
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono" 
              onClick={connect}
              disabled={status === 'connecting'}
            >
              <Wifi className="mr-2 h-4 w-4" /> 
              {status === 'connecting' ? 'Establishing Link...' : 'Connect to Drone'}
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 font-mono" 
              onClick={disconnect}
              disabled={isFlying}
            >
              <WifiOff className="mr-2 h-4 w-4" /> Disconnect Link
            </Button>
          )}
        </div>

        {/* Flight Controls */}
        {isConnected && (
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <p className="text-xs font-mono text-slate-500 uppercase">Flight Operations</p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono h-14"
                onClick={startMission}
                disabled={isFlying || status === 'emergency'}
              >
                <div className="flex flex-col items-center">
                  <PlaneTakeoff className="h-4 w-4 mb-1" />
                  <span className="text-[10px]">LAUNCH</span>
                </div>
              </Button>
              
              <Button 
                className="bg-blue-600 hover:bg-blue-500 text-white font-mono h-14"
                onClick={returnToHome}
                disabled={!isFlying}
              >
                <div className="flex flex-col items-center">
                  <Home className="h-4 w-4 mb-1" />
                  <span className="text-[10px]">RETURN (RTL)</span>
                </div>
              </Button>
            </div>
            
            <Button 
              variant="destructive"
              className="w-full font-mono bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700"
              onClick={emergencyLand}
              disabled={!isFlying}
            >
              <ShieldAlert className="mr-2 h-4 w-4" /> EMERGENCY LAND
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
