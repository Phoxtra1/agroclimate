import React, { useState } from "react";
import { useAIH } from "@/hooks/useAIH";
import { AircraftAsset, AircraftType, AircraftProtocol } from "@/services/aih/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plane, Cpu, User, MapPin, Plus, Trash2, Edit, Save, X, History,
  CheckCircle, ShieldAlert, Crosshair, Box, Layers, Landmark
} from "lucide-react";

const AIRCRAFT_TYPES: { value: AircraftType; label: string; icon: any }[] = [
  { value: "drone", label: "Drone (UAV)", icon: Cpu },
  { value: "helicopter", label: "Helicopter", icon: Crosshair },
  { value: "fixed_wing", label: "Fixed-Wing Aircraft", icon: Plane },
  { value: "air_ambulance", label: "Air Ambulance", icon: ShieldAlert },
  { value: "cargo", label: "Cargo Aircraft", icon: Box },
  { value: "evtol", label: "eVTOL (UAM)", icon: Cpu },
  { value: "survey", label: "Survey Aircraft", icon: Layers },
  { value: "maritime_patrol", label: "Maritime Patrol", icon: Landmark },
  { value: "custom", label: "Custom Aircraft", icon: Plane },
];

const PROTOCOLS: { value: AircraftProtocol; label: string }[] = [
  { value: "simulator", label: "Built-in Simulator" },
  { value: "wifi", label: "Wi-Fi Bridge" },
  { value: "mavlink", label: "MAVLink" },
  { value: "px4", label: "PX4 SDK" },
  { value: "ardupilot", label: "ArduPilot" },
  { value: "dji", label: "DJI Mobile SDK" },
  { value: "autel", label: "Autel SDK" },
  { value: "rtsp", label: "RTSP Video Stream" },
  { value: "webrtc", label: "WebRTC Data Channel" },
  { value: "adsb", label: "ADS-B Ingestion" },
  { value: "custom", label: "Custom Protocol API" },
];

export function AircraftRegistry() {
  const {
    aircrafts,
    flightHistory,
    registerAircraft,
    updateAircraft,
    removeAircraft,
    refreshHistory,
    activeAircraft,
  } = useAIH();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState<AircraftType>("drone");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [protocol, setProtocol] = useState<AircraftProtocol>("simulator");
  const [operator, setOperator] = useState("");
  const [homeBase, setHomeBase] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !manufacturer || !model) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    try {
      await registerAircraft({
        name,
        type,
        manufacturer,
        model,
        protocol,
        operator: operator || "Operator Duty",
        homeBase: homeBase || "Main Hangar",
      });
      toast({ title: "Asset Registered", description: `${name} has been added to the registry.` });
      resetForm();
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateAircraft(id, {
        name,
        type,
        manufacturer,
        model,
        protocol,
        operator,
        homeBase,
      });
      toast({ title: "Asset Updated", description: "Aircraft configuration saved." });
      setEditingId(null);
      resetForm();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const startEdit = (asset: AircraftAsset) => {
    setEditingId(asset.id);
    setName(asset.name);
    setType(asset.type);
    setManufacturer(asset.manufacturer);
    setModel(asset.model);
    setProtocol(asset.protocol);
    setOperator(asset.operator);
    setHomeBase(asset.homeBase);
    setIsAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (activeAircraft?.id === id) {
      toast({ title: "Action Blocked", description: "Cannot delete an active connected aircraft.", variant: "destructive" });
      return;
    }
    if (confirm(`Are you sure you want to remove ${name} from the registry?`)) {
      await removeAircraft(id);
      toast({ title: "Asset Removed", description: `${name} has been deleted.` });
    }
  };

  const showHistory = (id: string) => {
    setViewingHistoryId(id);
    refreshHistory(id);
  };

  const resetForm = () => {
    setName("");
    setType("drone");
    setManufacturer("");
    setModel("");
    setProtocol("simulator");
    setOperator("");
    setHomeBase("");
    setIsAdding(false);
  };

  const getAssetIcon = (type: AircraftType) => {
    const found = AIRCRAFT_TYPES.find(t => t.value === type);
    const Icon = found ? found.icon : Plane;
    return <Icon className="h-4 w-4 text-cyan-400" />;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      connected: "bg-emerald-900/30 text-emerald-400 border-emerald-700",
      connecting: "bg-amber-900/30 text-amber-400 border-amber-700 animate-pulse",
      disconnected: "bg-slate-800 text-slate-400 border-slate-700",
      lost: "bg-red-900/30 text-red-400 border-red-700 animate-bounce",
    };
    return (
      <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-mono ${styles[status] || styles.disconnected}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Registry Fleet List */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Universal Aircraft Registry
            </CardTitle>
            {!isAdding && !editingId && (
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 font-mono text-xs text-white" onClick={() => setIsAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> REGISTER ASSET
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {aircrafts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No aircraft assets registered. Add a drone, helicopter, or eVTOL.
                </div>
              ) : (
                aircrafts.map((a) => (
                  <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-950/40 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 shrink-0">
                        {getAssetIcon(a.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-mono font-bold text-sm text-slate-200">{a.name}</h4>
                          {getStatusBadge(a.status)}
                          {a.id === activeAircraft?.id && (
                            <Badge className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[8px]">ACTIVE TARGET</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
                          {a.manufacturer} {a.model} · <span className="text-slate-400">{a.type.replace("_", " ")}</span>
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-[10px] font-mono text-slate-400">
                          <div className="flex items-center gap-1"><User className="h-3 w-3 text-slate-600" /> {a.operator}</div>
                          <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-600" /> {a.homeBase}</div>
                          <div className="flex items-center gap-1"><Cpu className="h-3 w-3 text-slate-600" /> {a.protocol.toUpperCase()}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 md:self-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-800" title="History Logs" onClick={() => showHistory(a.id)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-800" title="Edit Configuration" onClick={() => startEdit(a)} disabled={a.id === activeAircraft?.id}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-slate-800" title="Deregister" onClick={() => handleDelete(a.id, a.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Aircraft Log Terminal */}
        {viewingHistoryId && (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <History className="h-3.5 w-3.5" /> Fleet Event & Flight Logs
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-slate-200" onClick={() => setViewingHistoryId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-3">
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
                {flightHistory.length === 0 ? (
                  <p className="text-slate-600 italic">No events recorded for this aircraft.</p>
                ) : (
                  flightHistory.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-slate-400 leading-relaxed border-b border-slate-900/50 pb-1.5 last:border-0">
                      <span className="text-cyan-600 shrink-0">[{new Date(h.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-amber-500 font-semibold shrink-0 uppercase">({h.eventType})</span>
                      <span className="text-slate-300">{h.details}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Forms Sidebar */}
      <div>
        {(isAdding || editingId) ? (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="py-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">
                {isAdding ? "Register Aircraft" : "Edit Configuration"}
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-500 hover:text-slate-200" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={isAdding ? handleRegister : (e) => { e.preventDefault(); handleSaveEdit(editingId!); }} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">Aircraft Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agro-Drone Gamma" className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs" required />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">Aircraft Type</label>
                    <Select value={type} onValueChange={(v: AircraftType) => setType(v)}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono text-xs">
                        {AIRCRAFT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">Protocol</label>
                    <Select value={protocol} onValueChange={(v: AircraftProtocol) => setProtocol(v)}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono text-xs">
                        {PROTOCOLS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">Manufacturer *</label>
                    <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Amineva" className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">Model *</label>
                    <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="AgroCop-V8" className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">Operator In-Charge</label>
                  <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Yaw Osei" className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs" />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-500 uppercase">Home Base Terminal</label>
                  <Input value={homeBase} onChange={(e) => setHomeBase(e.target.value)} placeholder="Hangar 4 - Kumasi" className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs" />
                </div>

                <div className="pt-2 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-mono" onClick={resetForm}>
                    CANCEL
                  </Button>
                  <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono">
                    {isAdding ? "REGISTER" : "SAVE"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="py-4 border-b border-slate-800">
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">Registry Manual</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 font-mono text-xs text-slate-400 leading-relaxed">
              <p>Register all commercial, civil, and security assets here to connect them to the dashboard.</p>
              
              <div className="border border-slate-800 p-2.5 rounded bg-slate-950 text-[10px] space-y-2">
                <div className="font-bold text-slate-200">Safeguard Protocols:</div>
                <div>• Commercial aircraft (Helicopter, Cargo, Air Ambulance) have controls disabled automatically.</div>
                <div>• Autonomous mission planners are available for Drones and eVTOLs.</div>
                <div>• In live telemetry operation, data is ingested directly with zero mock injections.</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
export default AircraftRegistry;
