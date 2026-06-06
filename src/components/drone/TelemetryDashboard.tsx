import React from 'react';
import { Activity, Battery, Compass, Gauge, Signal, Wind, Clock, Map } from 'lucide-react';
import { TelemetryData, EnvironmentData } from '@/hooks/useDroneState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TelemetryDashboardProps {
  telemetry: TelemetryData;
  environment: EnvironmentData;
}

export function TelemetryDashboard({ telemetry, environment }: TelemetryDashboardProps) {
  
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Flight Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TelemetryCard 
          icon={<Gauge className="h-4 w-4 text-cyan-400" />}
          label="Altitude"
          value={`${telemetry.altitude.toFixed(1)}`}
          unit="m"
        />
        <TelemetryCard 
          icon={<Gauge className="h-4 w-4 text-emerald-400" />}
          label="Ground Speed"
          value={`${telemetry.groundSpeed.toFixed(1)}`}
          unit="m/s"
        />
        <TelemetryCard 
          icon={<Compass className="h-4 w-4 text-purple-400" />}
          label="Heading"
          value={`${Math.round(telemetry.heading)}`}
          unit="°"
        />
        <TelemetryCard 
          icon={<Activity className="h-4 w-4 text-blue-400" />}
          label="Vertical Spd"
          value={`${telemetry.verticalSpeed.toFixed(1)}`}
          unit="m/s"
        />
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TelemetryCard 
          icon={<Battery className={`h-4 w-4 ${telemetry.battery > 20 ? 'text-emerald-400' : 'text-red-500'}`} />}
          label="Battery"
          value={`${telemetry.battery.toFixed(0)}`}
          unit="%"
          alert={telemetry.battery <= 20}
        />
        <TelemetryCard 
          icon={<Signal className="h-4 w-4 text-cyan-400" />}
          label="Signal Link"
          value={`${telemetry.signalStrength.toFixed(0)}`}
          unit="%"
        />
        <TelemetryCard 
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Flight Time"
          value={formatDuration(telemetry.flightDuration)}
          unit=""
        />
        <TelemetryCard 
          icon={<Map className="h-4 w-4 text-indigo-400" />}
          label="Distance"
          value={`${telemetry.distanceCovered.toFixed(0)}`}
          unit="m"
        />
      </div>

      {/* Environment Data */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="py-3 px-4 border-b border-slate-800">
          <CardTitle className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Wind className="h-4 w-4" /> Environmental Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-3 gap-4 font-mono text-sm">
          <div>
            <div className="text-slate-500 text-xs mb-1">WIND</div>
            <div className="text-slate-200">{environment.windSpeed.toFixed(1)} km/h {environment.windDirection}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">TEMP / HUM</div>
            <div className="text-slate-200">{environment.temperature}°C / {environment.humidity}%</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">VISIBILITY</div>
            <div className="text-slate-200">{environment.visibility} km</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TelemetryCard({ icon, label, value, unit, alert = false }: { icon: React.ReactNode, label: string, value: string, unit: string, alert?: boolean }) {
  return (
    <Card className={`bg-slate-900 border-slate-800 text-slate-100 ${alert ? 'border-red-500/50 bg-red-950/20' : ''}`}>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-baseline gap-1 mt-auto">
          <span className={`text-2xl font-mono font-semibold ${alert ? 'text-red-400' : 'text-slate-100'}`}>{value}</span>
          <span className="text-xs font-mono text-slate-500">{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}
