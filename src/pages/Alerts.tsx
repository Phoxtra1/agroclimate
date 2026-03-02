import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import { Bell, ChevronDown, ChevronUp, Check, Trash2, MessageSquarePlus, Send, Loader2 } from "lucide-react";
import { AlertTriangle, CheckCircle, Info, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const iconMap = { warning: AlertTriangle, danger: AlertOctagon, info: Info, success: CheckCircle };
const styleMap = {
  warning: "border-l-warning bg-warning/5",
  danger: "border-l-destructive bg-destructive/5",
  info: "border-l-accent bg-accent/5",
  success: "border-l-success bg-success/5",
};
const iconColorMap = { warning: "text-warning", danger: "text-destructive", info: "text-accent", success: "text-success" };

export default function Alerts() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const { toast } = useToast();
  const { alerts: visibleAlerts, unreadAlerts: unread, markRead, dismiss } = useUserAlerts(forecast, position.locationName);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", description: "", category: "general" });

  useEffect(() => {
    supabase.from("disaster_alerts").select("*").eq("active", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDbAlerts(data); });
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const readAlerts = visibleAlerts.filter(a => a.isRead);

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.description.trim()) {
      toast({ title: "Required", description: "Please fill in subject and description.", variant: "destructive" });
      return;
    }
    setTicketLoading(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      location: position.locationName,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket submitted", description: "Our support team will review your report." });
      setTicket({ subject: "", description: "", category: "general" });
      setShowTicketForm(false);
    }
    setTicketLoading(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Alerts</h1>
          {unread.length > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
              {unread.length} new
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowTicketForm(!showTicketForm)}>
          <MessageSquarePlus className="h-4 w-4 mr-1" /> Support Ticket
        </Button>
      </div>

      {/* Support Ticket Form */}
      {showTicketForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
          <h3 className="font-semibold text-sm">Submit a Support Ticket</h3>
          <Input placeholder="Subject" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} />
          <Select value={ticket.category} onValueChange={(v) => setTicket({ ...ticket, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="weather">Weather Issue</SelectItem>
              <SelectItem value="crop">Crop Problem</SelectItem>
              <SelectItem value="livestock">Livestock Issue</SelectItem>
              <SelectItem value="technical">Technical Problem</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Describe your issue..." value={ticket.description} onChange={(e) => setTicket({ ...ticket, description: e.target.value })} rows={4} />
          <div className="flex gap-2">
            <Button onClick={submitTicket} disabled={ticketLoading} size="sm">
              {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Submit</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowTicketForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Database disaster alerts */}
      {dbAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-sm text-destructive mb-3">⚠️ DISASTER ALERTS</h2>
          <div className="space-y-3">
            {dbAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border-l-4 border-l-destructive bg-destructive/5 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertOctagon className="h-4 w-4 text-destructive" />
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    {alert.affected_regions?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Regions: {alert.affected_regions.join(", ")}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {unread.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">NEW</h2>
              <div className="space-y-3">
                {unread.map((a) => {
                  const Icon = iconMap[a.type];
                  const expanded = expandedIds.has(a.id);
                  return (
                    <div key={a.id} className={`rounded-lg border-l-4 p-4 ${styleMap[a.type]} transition-all`}>
                      <div className="flex gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[a.type]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">{a.title}</h4>
                              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                            </div>
                            <button onClick={() => toggleExpand(a.id)} className="text-muted-foreground hover:text-foreground">
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className={`text-sm text-muted-foreground mt-1 ${!expanded ? "line-clamp-2" : ""}`}>{a.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <p className="text-xs text-muted-foreground">{a.time}</p>
                            <button onClick={() => markRead(a.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Check className="h-3 w-3" /> Mark read
                            </button>
                            <button onClick={() => dismiss(a.id)} className="text-xs text-destructive hover:underline flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {readAlerts.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">EARLIER</h2>
              <div className="space-y-3">
                {readAlerts.map((a) => {
                  const Icon = iconMap[a.type];
                  const expanded = expandedIds.has(a.id);
                  return (
                    <div key={a.id} className={`rounded-lg border-l-4 p-4 ${styleMap[a.type]} opacity-70 transition-all`}>
                      <div className="flex gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[a.type]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">{a.title}</h4>
                            <button onClick={() => toggleExpand(a.id)} className="text-muted-foreground hover:text-foreground">
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className={`text-sm text-muted-foreground mt-1 ${!expanded ? "line-clamp-2" : ""}`}>{a.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <p className="text-xs text-muted-foreground">{a.time}</p>
                            <button onClick={() => dismiss(a.id)} className="text-xs text-destructive hover:underline flex items-center gap-1">
                              <Trash2 className="h-3 w-3" /> Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {visibleAlerts.length === 0 && dbAlerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">No alerts yet</p>
            </div>
          )}
        </div>

        <div>
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">
              📱 Critical alerts are also sent via SMS to your registered phone number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
