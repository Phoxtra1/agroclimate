import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert } from "@/data/mock-data";
import { WeatherDay } from "@/data/mock-data";
import { getActiveProvider } from "@/lib/aiProviders/registry";
import { AIAlertAdvisory } from "@/lib/aiProviders/index";

interface UserAlertState {
  alert_id: string;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface EnrichedAlert extends Alert {
  isRead: boolean;
  isDismissed: boolean;
  isAiBacked?: boolean;
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function createAlertId(prefix: string, location: string, date: string) {
  const loc = location.replace(/[^a-zA-Z]/g, "").slice(0, 12).toLowerCase();
  return `${prefix}-${loc}-${date}`;
}

// Generate multi-domain alerts from real weather data
function generateWeatherAlerts(forecast: WeatherDay[], location: string): Alert[] {
  const alerts: Alert[] = [];
  const dk = dateKey();
  const timeStr = "Just now";

  if (!forecast || forecast.length === 0) return alerts;
  const today = forecast[0];

  // === WEATHER ===
  if (today.rainProb > 60) {
    alerts.push({
      id: createAlertId("weather-rain", location, dk),
      type: "warning",
      title: "Heavy Rain Alert",
      message: `${today.rainProb}% rain probability in ${location}. Prepare drainage and protect stored harvest.`,
      time: timeStr, read: false,
    });
  }

  if (today.tempHigh > 36) {
    alerts.push({
      id: createAlertId("weather-heat", location, dk),
      type: "danger",
      title: "Extreme Heat Warning",
      message: `Temperatures reaching ${today.tempHigh}°C in ${location}. Irrigate early morning or late evening.`,
      time: timeStr, read: false,
    });
  }

  if (today.wind > 30) {
    alerts.push({
      id: createAlertId("weather-wind", location, dk),
      type: "danger",
      title: "High Wind Warning",
      message: `Wind speeds of ${today.wind} km/h in ${location}. Secure structures and avoid aerial spraying.`,
      time: timeStr, read: false,
    });
  }

  // === CROPS ===
  if (today.humidity > 85 && today.tempHigh > 28) {
    alerts.push({
      id: createAlertId("crop-fungal", location, dk),
      type: "warning",
      title: "Crop Fungal Disease Risk",
      message: `High humidity (${today.humidity}%) with warm temps in ${location}. Monitor crops for blight, rust, and mildew.`,
      time: timeStr, read: false,
    });
  }

  if (today.tempHigh > 34 && today.rainProb < 20) {
    alerts.push({
      id: createAlertId("crop-wilt", location, dk),
      type: "warning",
      title: "Crop Wilt Stress",
      message: `Hot dry conditions in ${location} (${today.tempHigh}°C, ${today.rainProb}% rain). Irrigate water-sensitive crops immediately.`,
      time: timeStr, read: false,
    });
  }

  // === LIVESTOCK ===
  if (today.tempHigh > 35) {
    alerts.push({
      id: createAlertId("livestock-heat", location, dk),
      type: "danger",
      title: "Livestock Heat Stress",
      message: `${today.tempHigh}°C in ${location}. Provide shade, extra water, and reduce animal movement.`,
      time: timeStr, read: false,
    });
  }

  if (today.wind > 25 && today.rainProb > 40) {
    alerts.push({
      id: createAlertId("livestock-shelter", location, dk),
      type: "warning",
      title: "Livestock Shelter Advisory",
      message: `Storm conditions in ${location}. Move livestock to covered shelter and secure enclosures.`,
      time: timeStr, read: false,
    });
  }

  // === AQUACULTURE ===
  if (today.tempHigh > 33) {
    alerts.push({
      id: createAlertId("aqua-temp", location, dk),
      type: "warning",
      title: "Pond Temperature Warning",
      message: `High ambient temp (${today.tempHigh}°C) in ${location} may raise pond water temperature. Check dissolved oxygen and aerate if needed.`,
      time: timeStr, read: false,
    });
  }

  if (today.rainProb > 70) {
    alerts.push({
      id: createAlertId("aqua-overflow", location, dk),
      type: "warning",
      title: "Pond Overflow Risk",
      message: `Heavy rain expected in ${location}. Check pond outlets and drainage to prevent fish escape.`,
      time: timeStr, read: false,
    });
  }

  // === ENVIRONMENT ===
  if (today.humidity < 30 && today.tempHigh > 32) {
    alerts.push({
      id: createAlertId("env-fire", location, dk),
      type: "danger",
      title: "Bush Fire Risk",
      message: `Very low humidity (${today.humidity}%) and high heat in ${location}. Avoid open burning near farmland.`,
      time: timeStr, read: false,
    });
  }

  const avgRain = forecast.slice(0, 5).reduce((s, d) => s + d.rainProb, 0) / Math.min(forecast.length, 5);
  if (avgRain < 15) {
    alerts.push({
      id: createAlertId("env-drought", location, dk),
      type: "info",
      title: "Dry Spell Advisory",
      message: `Low rainfall expected this week in ${location} (avg ${Math.round(avgRain)}%). Plan irrigation for all crops.`,
      time: timeStr, read: false,
    });
  }

  // === FLIGHT ===
  if (today.wind > 25 || today.rainProb > 50) {
    alerts.push({
      id: createAlertId("flight-nofly", location, dk),
      type: "danger",
      title: "No-Fly Zone Precaution",
      message: `Unsafe flight conditions in ${location}. Avoid drone and light aircraft operations.`,
      time: timeStr, read: false,
    });
  }

  // === GOOD CONDITIONS ===
  if (today.rainProb > 25 && today.rainProb < 60 && today.tempHigh < 35 && today.tempHigh > 20) {
    alerts.push({
      id: createAlertId("crop-planting", location, dk),
      type: "success",
      title: "Good Planting Conditions",
      message: `Moderate moisture and mild temperatures in ${location}. Ideal for planting or transplanting.`,
      time: timeStr, read: false,
    });
  }

  return alerts;
}

export function useUserAlerts(forecast?: WeatherDay[], location?: string) {
  const { user } = useAuth();
  const [alertStates, setAlertStates] = useState<UserAlertState[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsSent, setSmsSent] = useState(false);

  const [aiAdvisory, setAiAdvisory] = useState<AIAlertAdvisory[] | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiAdvisory = useCallback(async (force = false) => {
    if (!forecast || forecast.length === 0 || !location) return;
    
    const cacheKey = `agroclimate_ai_alerts_${location.replace(/[^a-zA-Z]/g, "").toLowerCase()}`;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 4 * 60 * 60 * 1000) {
            setAiAdvisory(parsed.advisory);
            return;
          }
        } catch { /* bad cache */ }
      }
    }

    setIsAiLoading(true);
    setAiError(null);
    try {
      const provider = getActiveProvider();
      const data = await provider.generateAlertsAdvisory(location, forecast);
      if (Array.isArray(data) && data.length > 0) {
        setAiAdvisory(data);
        sessionStorage.setItem(cacheKey, JSON.stringify({ advisory: data, timestamp: Date.now() }));
      } else {
        throw new Error("No data returned from AI provider");
      }
    } catch (err: any) {
      console.warn("AI Alerts Advisory query failed, relying on rule-based engine:", err);
      setAiError(err.message || "AI service temporarily unavailable");
    } finally {
      setIsAiLoading(false);
    }
  }, [forecast, location]);

  useEffect(() => {
    fetchAiAdvisory();
  }, [fetchAiAdvisory]);

  // Fetch user's alert states from DB
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchStates = async () => {
      const { data } = await supabase
        .from("user_alerts")
        .select("alert_id, is_read, is_dismissed")
        .eq("user_id", user.id);
      if (data) setAlertStates(data);
      setLoading(false);
    };
    fetchStates();
  }, [user]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notifications for critical unread alerts
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!forecast || !location) return;

    const dynamicAlerts = generateWeatherAlerts(forecast, location);
    const critical = dynamicAlerts.filter(a => a.type === "danger");
    critical.forEach(a => {
      const state = alertStates.find(s => s.alert_id === a.id);
      if (!state?.is_read && !state?.is_dismissed) {
        try { new Notification(a.title, { body: a.message, icon: "/placeholder.svg" }); } catch {}
      }
    });
  }, [forecast, location, alertStates]);

  // Trigger SMS for critical conditions (once per session)
  useEffect(() => {
    if (!forecast || !location || smsSent || !forecast[0]) return;
    const today = forecast[0];
    const isCritical = today.rainProb > 70 || today.tempHigh > 38 || today.wind > 40 || (today.humidity > 90 && today.tempHigh > 28);
    if (isCritical) {
      setSmsSent(true);
      supabase.functions.invoke("weather-sms-alerts", {
        body: { weatherData: today, location },
      }).catch(console.warn);
    }
  }, [forecast, location, smsSent]);

  const getState = (alertId: string) =>
    alertStates.find((s) => s.alert_id === alertId);

  const dynamicAlerts = generateWeatherAlerts(forecast || [], location || "Your area");

  // Fetch disaster_alerts from DB
  const [dbAlerts, setDbAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    if (!user) {
      setDbAlerts([]);
      return;
    }

    let mounted = true;

    const fetchDisasterAlerts = async () => {
      const { data } = await supabase
        .from("disaster_alerts")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!mounted || !data) return;

      setDbAlerts(
        data.map((a) => ({
          id: a.id,
          type: a.severity === "critical" ? "danger" as const : "warning" as const,
          title: a.title,
          message: a.description || "",
          time: new Date(a.created_at).toLocaleString(),
          read: false,
        }))
      );
    };

    fetchDisasterAlerts();

    const channel = supabase
      .channel("user-alerts-disaster-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disaster_alerts" },
        () => {
          fetchDisasterAlerts();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const aiAlerts = useMemo(() => {
    if (!aiAdvisory) return [];
    const list: Alert[] = [];
    aiAdvisory.forEach((adv) => {
      adv.proactiveAlerts.forEach((pa, idx) => {
        list.push({
          id: `ai-alert-${adv.category}-${idx}-${dateKey()}`,
          type: pa.type,
          title: pa.title,
          message: pa.message,
          time: "AI Real-time Advisory",
          read: false,
          isAiBacked: true,
        } as any);
      });
    });
    return list;
  }, [aiAdvisory]);

  const allAlerts = [...aiAlerts, ...dynamicAlerts, ...dbAlerts];

  const enrichedAlerts: EnrichedAlert[] = allAlerts.map((a) => {
    const state = getState(a.id);
    return {
      ...a,
      isRead: state?.is_read ?? a.read,
      isDismissed: state?.is_dismissed ?? false,
      isAiBacked: (a as any).isAiBacked,
    };
  });

  const visibleAlerts = enrichedAlerts.filter((a) => !a.isDismissed);
  const unreadAlerts = visibleAlerts.filter((a) => !a.isRead);

  const upsertState = useCallback(async (alertId: string, updates: Partial<UserAlertState>) => {
    if (!user) return;
    const existing = alertStates.find(s => s.alert_id === alertId);
    if (existing) {
      await supabase
        .from("user_alerts")
        .update(updates)
        .eq("user_id", user.id)
        .eq("alert_id", alertId);
    } else {
      await supabase
        .from("user_alerts")
        .insert({ user_id: user.id, alert_id: alertId, is_read: false, is_dismissed: false, ...updates });
    }
    setAlertStates((prev) => {
      const idx = prev.findIndex((s) => s.alert_id === alertId);
      const base = idx >= 0 ? prev[idx] : { alert_id: alertId, is_read: false, is_dismissed: false };
      const updated = { ...base, ...updates };
      return idx >= 0 ? prev.map((s, i) => (i === idx ? updated : s)) : [...prev, updated];
    });
  }, [user, alertStates]);

  const markRead = useCallback((alertId: string) => upsertState(alertId, { is_read: true }), [upsertState]);
  const dismiss = useCallback((alertId: string) => upsertState(alertId, { is_dismissed: true }), [upsertState]);
  const markUnread = useCallback((alertId: string) => upsertState(alertId, { is_read: false }), [upsertState]);

  // Delete: remove from DB entirely
  const deleteAlert = useCallback(async (alertId: string) => {
    if (!user) return;
    await supabase.from("user_alerts").delete().eq("user_id", user.id).eq("alert_id", alertId);
    // Also dismiss locally so it vanishes immediately
    setAlertStates(prev => {
      const idx = prev.findIndex(s => s.alert_id === alertId);
      if (idx >= 0) {
        return prev.map((s, i) => i === idx ? { ...s, is_dismissed: true } : s);
      }
      return [...prev, { alert_id: alertId, is_read: true, is_dismissed: true }];
    });
  }, [user]);

  return {
    alerts: visibleAlerts,
    unreadAlerts,
    loading: loading || isAiLoading,
    isAiLoading,
    aiAdvisory,
    aiError,
    refreshAiAdvisory: () => fetchAiAdvisory(true),
    markRead,
    dismiss,
    markUnread,
    deleteAlert
  };
}
