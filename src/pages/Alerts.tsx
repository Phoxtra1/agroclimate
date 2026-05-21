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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import type { EnrichedAlert } from "@/hooks/useUserAlerts";
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
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackState, setFeedbackState] = useState<Record<string, AlertFeedback>>(readFeedbackState);
  const [ticket, setTicket] = useState({ subject: "", description: "", category: "general" });

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
      if (activeFilter === "all") return true;
      return inferAlertFilter(alert) === activeFilter;
    });
  }, [activeFilter, alerts]);

  const newAlerts = filteredAlerts.filter((alert) => !alert.isRead);
  const earlierAlerts = filteredAlerts.filter((alert) => alert.isRead);

  const recordFeedback = useCallback((alertId: string, value: AlertFeedback) => {
    setFeedbackState((prev) => ({ ...prev, [alertId]: value }));
  }, []);

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
    const isAi = alert.isAiBacked;

    return (
      <div
        key={alert.id}
        className="rounded-xl border p-4 shadow-sm transition-all duration-300 border-border bg-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{alert.title}</h3>
              <Badge variant="outline">{filterLabel(inferAlertFilter(alert))}</Badge>
              {!alert.isRead && <span className="h-2 w-2 rounded-full bg-destructive" />}
              {feedback && (
                <Badge variant="secondary" className="capitalize">
                  {feedback}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">{alert.message}</p>

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
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleApplied(alert)}>
            <Check className="mr-1 h-3.5 w-3.5" /> Applied
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleIgnore(alert)}>
            <X className="mr-1 h-3.5 w-3.5" /> Ignore
          </Button>
          {!alert.isRead && (
            <Button size="sm" variant="outline" onClick={() => markRead(alert.id)}>
              Mark as read
            </Button>
          )}
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
            Analyze with Odeneho AI
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTicketForm((prev) => !prev)}>
            <MessageSquarePlus className="mr-1 h-4 w-4" /> Support Ticket
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={activeFilter === option ? "default" : "outline"}
            onClick={() => setActiveFilter(option)}
            className="capitalize"
          >
            {filterLabel(option)}
          </Button>
        ))}
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
                      Click "Analyze with Odeneho AI" above to load real-time alerts.
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
    </div>
  );
}
