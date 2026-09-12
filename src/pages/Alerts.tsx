import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Trash2,
  X,
  Sparkles,
  Activity,
  ShieldCheck,
  History,
  Info,
  Play,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import type { EnrichedAlert, AlertLifecycleState } from "@/hooks/useUserAlerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type AlertFilter =
  | "all"
  | "weather"
  | "crop"
  | "livestock"
  | "aquaculture"
  | "environment"
  | "flight"
  | "general";

type AlertFeedback = "applied" | "ignored";

const FEEDBACK_KEY = "alert_feedback_state";

function readFeedbackState(): Record<string, AlertFeedback> {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function inferAlertFilter(alert: Pick<EnrichedAlert, "id" | "title" | "message">): AlertFilter {
  const source = `${alert.id} ${alert.title} ${alert.message}`.toLowerCase();

  if (source.includes("weather") || alert.id.startsWith("weather-")) return "weather";
  if (source.includes("crop") || source.includes("fungal") || source.includes("planting") || alert.id.startsWith("crop-")) return "crop";
  if (source.includes("livestock") || alert.id.startsWith("livestock-")) return "livestock";
  if (source.includes("pond") || source.includes("aquaculture") || source.includes("fish") || alert.id.startsWith("aqua-")) return "aquaculture";
  if (source.includes("environment") || source.includes("dry spell") || source.includes("bush fire") || alert.id.startsWith("env-")) return "environment";
  if (source.includes("flight") || source.includes("no-fly") || alert.id.startsWith("flight-")) return "flight";

  return "general";
}

function filterLabel(value: AlertFilter) {
  switch (value) {
    case "weather":
      return "Weather";
    case "crop":
      return "Crops";
    case "livestock":
      return "Livestock";
    case "aquaculture":
      return "Aquaculture";
    case "environment":
      return "Environment";
    case "flight":
      return "Flight";
    case "general":
      return "General";
    default:
      return "All";
  }
}

export default function Alerts() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast, loading: weatherLoading } = useWeather(position.lat, position.lon);
  const { toast } = useToast();
  const {
    alerts,
    unreadAlerts,
    markRead,
    dismiss,
    deleteAlert,
    aiAdvisory,
    isAiLoading,
    aiError,
    refreshAiAdvisory,
  } = useUserAlerts(forecast, position.locationName);

  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AlertFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "mitigating" | "resolved">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackState, setFeedbackState] = useState<Record<string, AlertFeedback>>(readFeedbackState);
  const [ticket, setTicket] = useState({ subject: "", description: "", category: "general" });

  // V1.6 Alert Lifecycle State Map (Local Storage persisted)
  const [lifecycleMap, setLifecycleMap] = useState<
    Record<string, { state: AlertLifecycleState; mitigationAction?: string; notes?: string; audit: { timestamp: string; event: string; actor: string }[] }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("alert_lifecycle_v16_map") || "{}");
    } catch {
      return {};
    }
  });

  const [mitigationModalAlert, setMitigationModalAlert] = useState<EnrichedAlert | null>(null);
  const [mitigationActionInput, setMitigationActionInput] = useState("");
  const [mitigationNotesInput, setMitigationNotesInput] = useState("");

  const [auditModalAlert, setAuditModalAlert] = useState<EnrichedAlert | null>(null);
  const [lineageModalAlert, setLineageModalAlert] = useState<EnrichedAlert | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("alert_lifecycle_v16_map", JSON.stringify(lifecycleMap));
    } catch {}
  }, [lifecycleMap]);

  const selectedAdvisory = useMemo(() => {
    if (!aiAdvisory || activeFilter === "all") return null;
    return aiAdvisory.find((adv) => adv.category === activeFilter);
  }, [aiAdvisory, activeFilter]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackState));
  }, [feedbackState]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Category filter
      if (activeFilter !== "all" && inferAlertFilter(alert) !== activeFilter) {
        return false;
      }
      // Status filter
      const lc = lifecycleMap[alert.id]?.state || alert.lifecycleState;
      if (statusFilter === "active" && (lc === "resolved" || lc === "in_mitigation")) return false;
      if (statusFilter === "mitigating" && lc !== "in_mitigation") return false;
      if (statusFilter === "resolved" && lc !== "resolved") return false;

      return true;
    });
  }, [activeFilter, statusFilter, alerts, lifecycleMap]);

  const newAlerts = filteredAlerts.filter((alert) => !alert.isRead);
  const earlierAlerts = filteredAlerts.filter((alert) => alert.isRead);

  const recordFeedback = useCallback((alertId: string, value: AlertFeedback) => {
    setFeedbackState((prev) => ({ ...prev, [alertId]: value }));
  }, []);

  const handleStartMitigation = (alert: EnrichedAlert) => {
    setMitigationModalAlert(alert);
    const existing = lifecycleMap[alert.id];
    setMitigationActionInput(existing?.mitigationAction || "Deploy field drainage and clear culvert channels");
    setMitigationNotesInput(existing?.notes || "");
  };

  const saveMitigationPlan = async () => {
    if (!mitigationModalAlert) return;
    const alertId = mitigationModalAlert.id;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setLifecycleMap((prev) => {
      const existingAudit = prev[alertId]?.audit || mitigationModalAlert.auditLog || [];
      return {
        ...prev,
        [alertId]: {
          state: "in_mitigation",
          mitigationAction: mitigationActionInput,
          notes: mitigationNotesInput,
          audit: [
            ...existingAudit,
            { timestamp: nowStr, event: `Mitigation Started: ${mitigationActionInput}`, actor: user?.email || "Operator" },
          ],
        },
      };
    });

    await markRead(alertId);
    toast({ title: "Mitigation Workflow Started", description: mitigationModalAlert.title });
    setMitigationModalAlert(null);
  };

  const handleResolveAlert = async (alert: EnrichedAlert) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLifecycleMap((prev) => {
      const existingAudit = prev[alert.id]?.audit || alert.auditLog || [];
      return {
        ...prev,
        [alert.id]: {
          state: "resolved",
          mitigationAction: prev[alert.id]?.mitigationAction || "Mitigation completed",
          notes: prev[alert.id]?.notes || "Resolved",
          audit: [
            ...existingAudit,
            { timestamp: nowStr, event: "Alert Risk Resolved & Verified", actor: user?.email || "Operator" },
          ],
        },
      };
    });

    await markRead(alert.id);
    recordFeedback(alert.id, "applied");
    toast({ title: "Alert Marked as Resolved", description: alert.title });
  };

  const handleApplied = useCallback(async (alert: EnrichedAlert) => {
    await markRead(alert.id);
    recordFeedback(alert.id, "applied");
    toast({ title: "Marked as applied", description: alert.title });
  }, [markRead, recordFeedback, toast]);

  const handleIgnore = useCallback(async (alert: EnrichedAlert) => {
    await dismiss(alert.id);
    recordFeedback(alert.id, "ignored");
    toast({ title: "Alert ignored", description: alert.title });
  }, [dismiss, recordFeedback, toast]);

  const handleDelete = useCallback(async (alert: EnrichedAlert) => {
    await deleteAlert(alert.id);
    toast({ title: "Alert deleted", description: alert.title });
  }, [deleteAlert, toast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast({ title: "Alerts updated", description: "Live weather and environment alerts refreshed." });
    }, 800);
  }, [toast]);

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.description.trim() || !user?.id) {
      toast({ title: "Required", description: "Please fill in subject and description.", variant: "destructive" });
      return;
    }

    setTicketLoading(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
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

  const filterOptions: AlertFilter[] = [
    "all",
    "weather",
    "crop",
    "livestock",
    "aquaculture",
    "environment",
    "flight",
    "general",
  ];

  const renderAlert = (alert: EnrichedAlert) => {
    const feedback = feedbackState[alert.id];
    const lcData = lifecycleMap[alert.id];
    const lcState: AlertLifecycleState = lcData?.state || alert.lifecycleState;

    return (
      <div
        key={alert.id}
        className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${
          lcState === "resolved"
            ? "border-success/30 bg-success/5"
            : lcState === "in_mitigation"
            ? "border-warning/30 bg-warning/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{alert.title}</h3>
              <Badge variant="outline">{filterLabel(inferAlertFilter(alert))}</Badge>

              {/* V1.6 Lifecycle Badge */}
              <Badge
                variant={
                  lcState === "resolved"
                    ? "secondary"
                    : lcState === "in_mitigation"
                    ? "outline"
                    : alert.type === "danger"
                    ? "destructive"
                    : "outline"
                }
                className="capitalize text-[10px]"
              >
                {lcState === "in_mitigation" ? "⚡ Mitigating" : lcState === "resolved" ? "✓ Resolved" : lcState}
              </Badge>

              {!alert.isRead && <span className="h-2 w-2 rounded-full bg-destructive" />}
              {feedback && (
                <Badge variant="secondary" className="capitalize">
                  {feedback}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">{alert.message}</p>

            {lcData?.mitigationAction && (
              <div className="p-2 rounded bg-muted/50 border border-border/40 text-xs space-y-0.5">
                <span className="font-semibold text-primary">Active Mitigation Plan:</span>
                <p className="text-foreground">{lcData.mitigationAction}</p>
                {lcData.notes && <p className="text-muted-foreground text-[11px]">Notes: {lcData.notes}</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span>{alert.time}</span>
              <span>•</span>
              <span>{position.locationName}</span>
              {forecast[0] && (
                <>
                  <span>•</span>
                  <span>{forecast[0].tempHigh}°/{forecast[0].tempLow}°</span>
                  <span>•</span>
                  <span>{forecast[0].rainProb}% rain</span>
                </>
              )}
              <span>•</span>
              <button
                onClick={() => setLineageModalAlert(alert)}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <Info className="h-3 w-3" /> Lineage & Transparency
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {lcState !== "resolved" && (
            <Button size="sm" variant="default" className="bg-primary text-primary-foreground" onClick={() => handleStartMitigation(alert)}>
              <Play className="mr-1 h-3.5 w-3.5" /> Mitigation Plan
            </Button>
          )}

          {lcState !== "resolved" ? (
            <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success" /> Mark Resolved
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleApplied(alert)}>
              <Check className="mr-1 h-3.5 w-3.5" /> Re-open Plan
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={() => setAuditModalAlert(alert)}>
            <History className="mr-1 h-3.5 w-3.5" /> Audit Trail
          </Button>

          <Button size="sm" variant="outline" onClick={() => handleIgnore(alert)}>
            <X className="mr-1 h-3.5 w-3.5" /> Ignore
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDelete(alert)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Live Alerts</h1>
            {unreadAlerts.length > 0 && (
              <Badge>{unreadAlerts.length} new</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Weather and environment alerts for {position.locationName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-300 relative group overflow-hidden flex items-center gap-1.5"
            onClick={refreshAiAdvisory}
            disabled={isAiLoading}
          >
            {isAiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary-foreground group-hover:scale-110 transition-transform" />
            )}
            Analyze with Dipa
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTicketForm((prev) => !prev)}>
            <MessageSquarePlus className="mr-1 h-4 w-4" /> Support Ticket
          </Button>
        </div>
      </div>

      {/* Filter Toolbar (Category + Lifecycle Status) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={activeFilter === option ? "default" : "ghost"}
              onClick={() => setActiveFilter(option)}
              className="capitalize text-xs h-7 px-2.5"
            >
              {filterLabel(option)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border text-xs">
          <span className="px-2 text-[10px] font-semibold text-muted-foreground uppercase">Status:</span>
          {(["all", "active", "mitigating", "resolved"] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? "default" : "ghost"}
              onClick={() => setStatusFilter(st)}
              className="capitalize text-[11px] h-6 px-2"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {showTicketForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Submit a Support Ticket</h2>
          <Input placeholder="Subject" value={ticket.subject} onChange={(e) => setTicket((prev) => ({ ...prev, subject: e.target.value }))} />
          <Select value={ticket.category} onValueChange={(value) => setTicket((prev) => ({ ...prev, category: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="weather">Weather Issue</SelectItem>
              <SelectItem value="crop">Crop Problem</SelectItem>
              <SelectItem value="livestock">Livestock Issue</SelectItem>
              <SelectItem value="aquaculture">Aquaculture Issue</SelectItem>
              <SelectItem value="technical">Technical Problem</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            rows={4}
            placeholder="Describe your issue..."
            value={ticket.description}
            onChange={(e) => setTicket((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={submitTicket} disabled={ticketLoading} size="sm">
              {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" /> Submit</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowTicketForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {weatherLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            {newAlerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">New Alerts</h2>
                {newAlerts.map(renderAlert)}
              </section>
            )}

            {earlierAlerts.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Earlier Alerts</h2>
                {earlierAlerts.map(renderAlert)}
              </section>
            )}

            {filteredAlerts.length === 0 && (
              <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
                <Bell className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">No alerts for this category right now.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* AI Proactive Advisory Hub */}
            {selectedAdvisory ? (
              <div className="rounded-xl border border-border bg-card p-4 relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full blur-3xl" />
                
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    AI Proactive Advisory
                  </h3>
                  <Badge variant={selectedAdvisory.level === "critical" || selectedAdvisory.level === "high" ? "destructive" : "secondary"} className="capitalize">
                    {selectedAdvisory.level} Risk
                  </Badge>
                </div>

                <div className="flex items-center gap-4 py-2 border-b border-border/50 mb-3">
                  <div className="relative h-14 w-14 flex items-center justify-center flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="28" cy="28" r="22" stroke="hsl(var(--border))" strokeWidth="4" fill="transparent" />
                      <circle
                        cx="28" cy="28" r="22"
                        stroke={selectedAdvisory.score > 70 ? "hsl(var(--destructive))" : selectedAdvisory.score > 40 ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 22}
                        strokeDashoffset={2 * Math.PI * 22 * (1 - selectedAdvisory.score / 100)}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <span className="absolute text-xs font-black">{selectedAdvisory.score}%</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Category Risk Index</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Calculated in real-time from the backend weather API stream.</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {selectedAdvisory.diseaseRisk !== "None" && (
                    <div className="p-2 rounded bg-muted/50 border border-border/30">
                      <p className="font-semibold text-muted-foreground">🦠 Disease/Spore Outbreak Risk</p>
                      <p className="mt-0.5 text-foreground font-medium">{selectedAdvisory.diseaseRisk}</p>
                    </div>
                  )}

                  {selectedAdvisory.disasterWarning !== "None" && (
                    <div className="p-2 rounded bg-destructive/5 border border-destructive/10">
                      <p className="font-semibold text-destructive/80">⚠️ Disaster Preparedness Warning</p>
                      <p className="mt-0.5 text-foreground font-medium">{selectedAdvisory.disasterWarning}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="font-semibold text-muted-foreground">💡 Dynamic Farmer Guidance</p>
                    <p className="text-muted-foreground leading-relaxed italic bg-muted/30 p-2.5 rounded-lg border border-border/30">
                      "{selectedAdvisory.advice}"
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Activity className="h-4 w-4 text-primary animate-pulse" />
                    AI Ecological Health Panel
                  </h3>
                  {isAiLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                
                <div className="space-y-2.5">
                  {aiAdvisory ? (
                    aiAdvisory.map((adv) => (
                      <div key={adv.category} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                        <span className="capitalize font-semibold text-muted-foreground flex items-center gap-1.5">
                          {filterLabel(adv.category)}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${adv.score > 70 ? "bg-destructive" : adv.score > 40 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${adv.score}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] w-6 text-right font-bold">{adv.score}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-[11px] text-muted-foreground">
                      <Sparkles className="h-5 w-5 mx-auto mb-2 text-primary animate-pulse" />
                      Click "Analyze with Dipa" above to load real-time alerts.
                    </div>
                  )}
                </div>
                
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                  • Select any category filter above to unlock deep, localized disease predictions and proactive farmer guidance for that sector.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Live Data Source</h3>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>• Alerts are generated from your current weather and environment feed.</li>
                <li>• Categories cover crops, livestock, aquaculture, environment, weather, and flight risk.</li>
                <li>• Applied, Ignore, Mark as read, and Delete now update immediately.</li>
              </ul>
            </div>

            {forecast[0] && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">Current Conditions</h3>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>{position.locationName}</p>
                  <p>{forecast[0].description}</p>
                  <p>Temperature: {forecast[0].tempHigh}° / {forecast[0].tempLow}°</p>
                  <p>Humidity: {forecast[0].humidity}%</p>
                  <p>Wind: {forecast[0].wind} km/h</p>
                  <p>Rain probability: {forecast[0].rainProb}%</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mitigation Workflow Dialog */}
      <Dialog open={!!mitigationModalAlert} onOpenChange={(open) => !open && setMitigationModalAlert(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" /> Start Mitigation Workflow
            </DialogTitle>
            <DialogDescription>
              Action plan for "{mitigationModalAlert?.title}" in {position.locationName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Mitigation Action Plan</label>
              <Input
                value={mitigationActionInput}
                onChange={(e) => setMitigationActionInput(e.target.value)}
                placeholder="Describe action step e.g. Clear drainage culvert"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Operational Notes / Field Logs</label>
              <Textarea
                rows={3}
                value={mitigationNotesInput}
                onChange={(e) => setMitigationNotesInput(e.target.value)}
                placeholder="Assignee, expected completion, equipment required..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMitigationModalAlert(null)}>Cancel</Button>
            <Button size="sm" onClick={saveMitigationPlan}>Confirm & Start Mitigation</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit History Trail Dialog */}
      <Dialog open={!!auditModalAlert} onOpenChange={(open) => !open && setAuditModalAlert(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Lifecycle Audit History
            </DialogTitle>
            <DialogDescription>
              Chronological log for alert ID: {auditModalAlert?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {((auditModalAlert && lifecycleMap[auditModalAlert.id]?.audit) || auditModalAlert?.auditLog || []).map((entry, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded bg-muted/40 border border-border/40 text-xs">
                <span className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                <div className="space-y-0.5 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">{entry.event}</span>
                    <span className="text-[10px] text-muted-foreground">{entry.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Actor: {entry.actor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setAuditModalAlert(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lineage & Transparency Modal */}
      <Dialog open={!!lineageModalAlert} onOpenChange={(open) => !open && setLineageModalAlert(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Data Lineage & Transparency
            </DialogTitle>
            <DialogDescription>
              Technical evaluation provenance for "{lineageModalAlert?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-muted-foreground">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
              <p><strong className="text-foreground">Data Provider Stream:</strong> {lineageModalAlert?.lineage.source}</p>
              <p><strong className="text-foreground">Model Confidence Rating:</strong> {lineageModalAlert?.lineage.confidence}% Verified</p>
              <p><strong className="text-foreground">Evaluation Methodology:</strong> {lineageModalAlert?.lineage.method}</p>
              <p><strong className="text-foreground">Geographic Coordinates:</strong> Lat {position.lat.toFixed(4)}, Lon {position.lon.toFixed(4)}</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setLineageModalAlert(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
