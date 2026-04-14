import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plane, Key, CheckCircle, XCircle, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface APIConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  active: boolean;
  lastChecked?: string;
  status: "connected" | "disconnected" | "error";
}

export default function FlightEngine() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<APIConfig[]>([
    {
      id: "aviation-weather",
      name: "Aviation Weather API (METAR/TAF)",
      endpoint: "https://aviationweather.gov/api/data",
      apiKey: "",
      active: false,
      status: "disconnected",
    },
    {
      id: "opensky",
      name: "OpenSky Network",
      endpoint: "https://opensky-network.org/api",
      apiKey: "",
      active: false,
      status: "disconnected",
    },
  ]);

  const [newApi, setNewApi] = useState({ name: "", endpoint: "", apiKey: "" });

  const addApi = () => {
    if (!newApi.name || !newApi.endpoint) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    setConfigs(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newApi.name,
        endpoint: newApi.endpoint,
        apiKey: newApi.apiKey,
        active: false,
        status: "disconnected",
      },
    ]);
    setNewApi({ name: "", endpoint: "", apiKey: "" });
    toast({ title: "API source added" });
  };

  const toggleApi = (id: string) => {
    setConfigs(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, active: !c.active, status: !c.active ? "connected" : "disconnected", lastChecked: new Date().toISOString() }
          : c
      )
    );
  };

  const testConnection = async (id: string) => {
    const config = configs.find(c => c.id === id);
    if (!config) return;

    try {
      const res = await fetch(config.endpoint, { method: "HEAD", mode: "no-cors" });
      setConfigs(prev =>
        prev.map(c => c.id === id ? { ...c, status: "connected", lastChecked: new Date().toISOString() } : c)
      );
      toast({ title: "Connection OK", description: `${config.name} is reachable.` });
    } catch {
      setConfigs(prev =>
        prev.map(c => c.id === id ? { ...c, status: "error", lastChecked: new Date().toISOString() } : c)
      );
      toast({ title: "Connection failed", description: `Could not reach ${config.name}.`, variant: "destructive" });
    }
  };

  const removeApi = (id: string) => {
    setConfigs(prev => prev.filter(c => c.id !== id));
    toast({ title: "API source removed" });
  };

  const updateKey = (id: string, key: string) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, apiKey: key } : c));
  };

  const statusIcon = (s: string) => {
    if (s === "connected") return <CheckCircle className="h-4 w-4 text-primary" />;
    if (s === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Globe className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Plane className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Flight Advisory — API Management</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure external API endpoints that power the Flight Advisory component on the user dashboard. Active APIs will feed real-time data to users.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Add External API Source</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="API name (e.g. METAR Service)" value={newApi.name} onChange={e => setNewApi({ ...newApi, name: e.target.value })} />
          <Input placeholder="Endpoint URL" value={newApi.endpoint} onChange={e => setNewApi({ ...newApi, endpoint: e.target.value })} />
          <Input placeholder="API Key (optional)" type="password" value={newApi.apiKey} onChange={e => setNewApi({ ...newApi, apiKey: e.target.value })} />
          <Button onClick={addApi}><Key className="mr-2 h-4 w-4" /> Add API Source</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configured API Sources</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API sources configured.</p>
          ) : configs.map(config => (
            <div key={config.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {statusIcon(config.status)}
                  <h4 className="font-medium">{config.name}</h4>
                  <Badge variant={config.active ? "default" : "outline"}>{config.active ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={config.active} onCheckedChange={() => toggleApi(config.id)} />
                  <Button size="sm" variant="outline" onClick={() => testConnection(config.id)}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeApi(config.id)}>
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground break-all">{config.endpoint}</p>
              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <Input type="password" placeholder="Enter API key" value={config.apiKey} onChange={e => updateKey(config.id, e.target.value)} className="text-sm" />
              </div>
              {config.lastChecked && (
                <p className="text-xs text-muted-foreground">Last checked: {new Date(config.lastChecked).toLocaleString()}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
