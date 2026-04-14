import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Plus } from "lucide-react";

interface AlertItem {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  alert_type: string;
  affected_regions: string[] | null;
  active: boolean;
  created_at: string;
}

export default function AlertEngine() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: "",
    description: "",
    severity: "warning",
    alert_type: "weather",
    affected_regions: "",
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("disaster_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAlerts(data as AlertItem[]);
  };

  const createAlert = async () => {
    if (!newAlert.title || !newAlert.alert_type) return;
    const { error } = await supabase.from("disaster_alerts").insert({
      title: newAlert.title,
      description: newAlert.description,
      severity: newAlert.severity,
      alert_type: newAlert.alert_type,
      affected_regions: newAlert.affected_regions.split(",").map((r) => r.trim()).filter(Boolean),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alert created" });
      setShowForm(false);
      setNewAlert({ title: "", description: "", severity: "warning", alert_type: "weather", affected_regions: "" });
      fetchAlerts();
    }
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from("disaster_alerts").update({ active: !active }).eq("id", id);
    fetchAlerts();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Bell className="mx-auto mb-1 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">{alerts.filter(a => a.active).length}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{alerts.length}</p>
            <p className="text-xs text-muted-foreground">Total Alerts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Disaster Alerts</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> New Alert
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="bg-muted p-4 rounded-lg mb-4 space-y-3">
              <Input placeholder="Alert title" value={newAlert.title} onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })} />
              <Textarea placeholder="Description" value={newAlert.description} onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newAlert.severity} onValueChange={(v) => setNewAlert({ ...newAlert, severity: v })}>
                  <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newAlert.alert_type} onValueChange={(v) => setNewAlert({ ...newAlert, alert_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weather">Weather</SelectItem>
                    <SelectItem value="flood">Flood</SelectItem>
                    <SelectItem value="drought">Drought</SelectItem>
                    <SelectItem value="pest">Pest Outbreak</SelectItem>
                    <SelectItem value="disease">Disease Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Affected regions (comma separated)" value={newAlert.affected_regions} onChange={(e) => setNewAlert({ ...newAlert, affected_regions: e.target.value })} />
              <Button className="w-full" onClick={createAlert}>Publish Alert</Button>
            </div>
          )}
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No alerts yet.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{alert.title}</h3>
                      <Badge variant={alert.active ? "default" : "secondary"} className="text-[10px]">
                        {alert.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    {alert.affected_regions && alert.affected_regions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Regions: {alert.affected_regions.join(", ")}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleAlert(alert.id, alert.active)}>
                    {alert.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
