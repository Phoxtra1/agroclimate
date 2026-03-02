import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert } from "@/data/mock-data";
import { WeatherDay } from "@/data/mock-data";

interface UserAlertState {
  alert_id: string;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface EnrichedAlert extends Alert {
  isRead: boolean;
  isDismissed: boolean;
}

// Generate dynamic alerts based on real-time weather
function generateWeatherAlerts(forecast: WeatherDay[], location: string): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const timeStr = "Just now";

  if (!forecast || forecast.length === 0) return alerts;

  const today = forecast[0];

  if (today.rainProb > 60) {
    alerts.push({
      id: `weather-rain-${now.toDateString()}`,
      type: "warning",
      title: "Heavy Rain Alert",
      message: `${today.rainProb}% rain probability expected in ${location}. Prepare drainage channels and protect stored harvest.`,
      time: timeStr,
      read: false,
    });
  }

  if (today.tempHigh > 36) {
    alerts.push({
      id: `weather-heat-${now.toDateString()}`,
      type: "danger",
      title: "Extreme Heat Warning",
      message: `Temperatures reaching ${today.tempHigh}°C in ${location}. Irrigate crops early morning or late evening. Keep livestock hydrated.`,
      time: timeStr,
      read: false,
    });
  }

  if (today.humidity > 85 && today.tempHigh > 28) {
    alerts.push({
      id: `weather-fungal-${now.toDateString()}`,
      type: "warning",
      title: "Fungal Disease Risk",
      message: `High humidity (${today.humidity}%) combined with warm temperatures in ${location}. Monitor crops for fungal infections.`,
      time: timeStr,
      read: false,
    });
  }

  if (today.wind > 30) {
    alerts.push({
      id: `weather-wind-${now.toDateString()}`,
      type: "danger",
      title: "High Wind Warning",
      message: `Wind speeds of ${today.wind} km/h in ${location}. Secure greenhouse structures and avoid aerial spraying.`,
      time: timeStr,
      read: false,
    });
  }

  // Good conditions alert
  if (today.rainProb > 25 && today.rainProb < 60 && today.tempHigh < 35) {
    alerts.push({
      id: `weather-planting-${now.toDateString()}`,
      type: "success",
      title: "Good Planting Conditions",
      message: `Moderate moisture expected in ${location}. Soil conditions are ideal for planting or transplanting.`,
      time: timeStr,
      read: false,
    });
  }

  // Dry spell warning
  const avgRain = forecast.slice(0, 5).reduce((s, d) => s + d.rainProb, 0) / Math.min(forecast.length, 5);
  if (avgRain < 15) {
    alerts.push({
      id: `weather-dry-${now.toDateString()}`,
      type: "info",
      title: "Dry Spell Advisory",
      message: `Very low rainfall expected this week in ${location} (avg ${Math.round(avgRain)}%). Plan irrigation for water-intensive crops.`,
      time: timeStr,
      read: false,
    });
  }

  // No-fly zone precaution
  if (today.wind > 25 || today.rainProb > 50) {
    alerts.push({
      id: `flight-nofly-${now.toDateString()}`,
      type: "danger",
      title: "No-Fly Zone Precaution",
      message: `Unsafe flight conditions in ${location} — ${today.wind > 25 ? `high winds (${today.wind} km/h)` : ""}${today.wind > 25 && today.rainProb > 50 ? " and " : ""}${today.rainProb > 50 ? `rain probability (${today.rainProb}%)` : ""}. Avoid drone, helicopter, and light aircraft operations.`,
      time: timeStr,
      read: false,
    });
  }

  return alerts;
}

export function useUserAlerts(forecast?: WeatherDay[], location?: string) {
  const { user } = useAuth();
  const [alertStates, setAlertStates] = useState<UserAlertState[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsSent, setSmsSent] = useState(false);

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

  // Generate dynamic alerts from weather
  const dynamicAlerts = generateWeatherAlerts(forecast || [], location || "Your area");

  // Also fetch disaster_alerts from DB
  const [dbAlerts, setDbAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    supabase.from("disaster_alerts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => {
        if (data) {
          setDbAlerts(data.map(a => ({
            id: a.id,
            type: a.severity === "critical" ? "danger" as const : "warning" as const,
            title: a.title,
            message: a.description || "",
            time: new Date(a.created_at).toLocaleDateString(),
            read: false,
          })));
        }
      });
  }, []);

  const allAlerts = [...dynamicAlerts, ...dbAlerts];

  const enrichedAlerts: EnrichedAlert[] = allAlerts.map((a) => {
    const state = getState(a.id);
    return {
      ...a,
      isRead: state?.is_read ?? a.read,
      isDismissed: state?.is_dismissed ?? false,
    };
  });

  const visibleAlerts = enrichedAlerts.filter((a) => !a.isDismissed);
  const unreadAlerts = visibleAlerts.filter((a) => !a.isRead);

  const upsertState = useCallback(async (alertId: string, updates: Partial<UserAlertState>) => {
    if (!user) return;
    const existing = getState(alertId);
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

  return { alerts: visibleAlerts, unreadAlerts, loading, markRead, dismiss, markUnread };
}
