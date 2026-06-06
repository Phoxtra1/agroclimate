import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScanSearch, Leaf, Droplets, Bug } from 'lucide-react';

export function OdenehoVision() {
  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
          <ScanSearch className="h-4 w-4" /> Odeneho Vision Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <p className="text-xs font-mono text-slate-500">REAL-TIME AERIAL INFERENCE</p>
        
        <div className="space-y-3">
          <VisionItem 
            icon={<Leaf className="h-4 w-4 text-emerald-500" />}
            label="Crop Health (NDVI Proxy)"
            status="Healthy"
            score="0.82"
          />
          <VisionItem 
            icon={<Droplets className="h-4 w-4 text-blue-500" />}
            label="Soil Moisture Pattern"
            status="Even Distribution"
            score="Optimal"
          />
          <VisionItem 
            icon={<Bug className="h-4 w-4 text-amber-500" />}
            label="Pest Damage Detection"
            status="No signatures found"
            score="0.01"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-500">PROCESSING FPS</span>
            <span className="text-cyan-400">24.5 FPS</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">MODEL LATENCY</span>
            <span className="text-cyan-400">42ms</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisionItem({ icon, label, status, score }: { icon: React.ReactNode, label: string, status: string, score: string }) {
  return (
    <div className="bg-slate-950 p-3 rounded border border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="text-xs font-mono text-slate-300">{label}</div>
          <div className="text-[10px] font-mono text-slate-500">{status}</div>
        </div>
      </div>
      <div className="text-xs font-mono text-cyan-400">{score}</div>
    </div>
  );
}
