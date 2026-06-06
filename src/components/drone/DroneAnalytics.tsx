import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Activity, Target, ShieldCheck } from 'lucide-react';

export function DroneAnalytics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<Activity className="h-5 w-5 text-cyan-400" />} label="TOTAL FLIGHT TIME" value="124h 30m" />
      <StatCard icon={<Target className="h-5 w-5 text-emerald-400" />} label="MISSIONS COMPLETED" value="84" />
      <StatCard icon={<BarChart3 className="h-5 w-5 text-purple-400" />} label="AREA SURVEYED" value="1,420 Ha" />
      <StatCard icon={<ShieldCheck className="h-5 w-5 text-blue-400" />} label="SAFETY INCIDENTS" value="0" />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">{label}</div>
          <div className="text-xl font-mono font-bold text-slate-200">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
