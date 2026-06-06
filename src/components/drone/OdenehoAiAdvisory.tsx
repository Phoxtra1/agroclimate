import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, ShieldAlert, Zap, Wind, Navigation } from 'lucide-react';
import { TelemetryData, EnvironmentData } from '@/hooks/useDroneState';

export function OdenehoAiAdvisory({ telemetry, environment }: { telemetry: TelemetryData, environment: EnvironmentData }) {
  
  const getAlerts = () => {
    const alerts = [];
    if (environment.windSpeed > 20) {
      alerts.push({ type: 'warning', icon: <Wind className="h-4 w-4" />, text: 'High Wind Warning: Compensating pitch.' });
    }
    if (telemetry.battery < 30) {
      alerts.push({ type: 'critical', icon: <Zap className="h-4 w-4" />, text: 'Low Battery: Return Home recommended.' });
    }
    if (telemetry.signalStrength < 50) {
      alerts.push({ type: 'warning', icon: <ShieldAlert className="h-4 w-4" />, text: 'Signal Degradation Detected.' });
    }
    if (alerts.length === 0) {
      alerts.push({ type: 'info', icon: <Bot className="h-4 w-4" />, text: 'Conditions optimal. Route efficiency at 98%.' });
    }
    return alerts;
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
          <Bot className="h-4 w-4" /> Odeneho Flight Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {getAlerts().map((alert, i) => (
          <div key={i} className={`p-3 rounded border flex items-start gap-3 font-mono text-sm ${
            alert.type === 'critical' ? 'bg-red-950/30 border-red-900/50 text-red-400' :
            alert.type === 'warning' ? 'bg-amber-950/30 border-amber-900/50 text-amber-400' :
            'bg-slate-950/50 border-slate-800 text-slate-300'
          }`}>
            <div className="mt-0.5">{alert.icon}</div>
            <div>{alert.text}</div>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <div className="text-slate-500 mb-1">SAFETY SCORE</div>
            <div className="text-emerald-400 text-xl font-bold">94/100</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">RECOMMENDATION</div>
            <div className="text-cyan-400">Continue Mission</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
