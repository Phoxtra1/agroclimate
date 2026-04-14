import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Alert {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: "info" | "warning" | "danger";
  active: boolean;
  created_at: string;
}

const ALERT_CATEGORIES = [
  "Flood", "Weather", "Disaster", "Environment", "Crops",
  "Livestock", "Aquaculture", "Fire", "Drought", "Storm",
  "Pest Outbreak", "Disease Alert",
];

export default function AlertEngine() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [newAlert, setNewAlert] = useState({ title: "", message: "", category: "", severity: "warning" as Alert["severity"] });
  const [sending, setSending] = useState(false);

  const sendAlert = async () => {
    if (!newAlert.title || !newAlert.message || !newAlert.category) {
      toast({ title: "Missing fields", description: "Fill in all alert fields", variant: "destructive" });
      return;
    }
    setSending(true);

    const alertData = {
      id: crypto.randomUUID(),
      ...newAlert,
      active: true,
      created_at: new Date().toISOString(),
    };

    // Attempt to insert into disaster_alerts table
    const { error } = await supabase.from("disaster_alerts").insert({
      title: alertData.title,
      description: alertData.message,
      alert_type: alertData.category.toLowerCase(),
      severity: alertData.severity,
      active: true,
    });

    if (error) {
      console.error("Alert insert error:", error);
    }

    setAlerts(prev => [alertData, ...prev]);
    setNewAlert({ title: "", message: "", category: "", severity: "warning" });
    setSending(false);
    toast({ title: "Alert Sent", description: `"${alertData.title}" dispatched to all users.` });
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast({ title: "Alert removed" });
  };

  const severityColor = (s: string) => {
    if (s === "danger") return "destructive";
    if (s === "warning") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Alert Engine</h2>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Create New Alert</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Alert title" value={newAlert.title} onChange={e => setNewAlert({ ...newAlert, title: e.target.value })} />
          <Textarea placeholder="Alert message — this will be shown to all users" value={newAlert.message} onChange={e => setNewAlert({ ...newAlert, message: e.target.value })} rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newAlert.category} onValueChange={v => setNewAlert({ ...newAlert, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {ALERT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={newAlert.severity} onValueChange={v => setNewAlert({ ...newAlert, severity: v as Alert["severity"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="danger">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={sendAlert} disabled={sending} className="w-full sm:w-auto">
            <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Dispatch Alert"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Active Alerts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts dispatched yet. Create one above.</p>
          ) : alerts.map(alert => (
            <div key={alert.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{alert.title}</h4>
                  <Badge variant={severityColor(alert.severity) as any}>{alert.severity.toUpperCase()}</Badge>
                  <Badge variant="outline">{alert.category}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={alert.active} onCheckedChange={() => toggleAlert(alert.id)} />
                    <span className="text-xs text-muted-foreground">{alert.active ? "Active" : "Off"}</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeAlert(alert.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              <p className="text-xs text-muted-foreground">Sent: {new Date(alert.created_at).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
