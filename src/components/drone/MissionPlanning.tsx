import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Clock, Battery, Map } from 'lucide-react';

export function MissionPlanning() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <Route className="h-4 w-4" /> Mission Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500">MISSION NAME</label>
                <Input placeholder="e.g. North Field Survey" className="bg-slate-950 border-slate-800 text-slate-300 font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500">MISSION TYPE</label>
                <Select defaultValue="mapping">
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono">
                    <SelectItem value="mapping">Farm Mapping</SelectItem>
                    <SelectItem value="inspection">Crop Inspection</SelectItem>
                    <SelectItem value="spraying">Spraying Mission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500">ALTITUDE (m)</label>
                <Input type="number" defaultValue={50} className="bg-slate-950 border-slate-800 text-slate-300 font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500">SPEED (m/s)</label>
                <Input type="number" defaultValue={10} className="bg-slate-950 border-slate-800 text-slate-300 font-mono" />
              </div>
            </div>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono mt-4">
              GENERATE FLIGHT PLAN
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">
              Estimates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-mono text-slate-500 flex items-center gap-2"><Clock className="h-4 w-4" /> FLIGHT TIME</span>
              <span className="text-sm font-mono text-slate-300">14m 30s</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-mono text-slate-500 flex items-center gap-2"><Battery className="h-4 w-4" /> BATTERY EST.</span>
              <span className="text-sm font-mono text-slate-300">32% required</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-xs font-mono text-slate-500 flex items-center gap-2"><Map className="h-4 w-4" /> COVERAGE</span>
              <span className="text-sm font-mono text-slate-300">12.4 Hectares</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
