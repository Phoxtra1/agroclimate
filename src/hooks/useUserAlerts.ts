import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, alerts as mockAlerts } from "@/data/mock-data";

interface UserAlertState {
  alert_id: string;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface EnrichedAlert extends Alert {
  isRead: boolean;
  isDismissed: boolean;
}

export function useUserAlerts() {
  const { user } = useAuth();
  const [alertStates, setAlertStates] = useState<UserAlertState[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's alert states from DB
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("user_alerts")
        .select("alert_id, is_read, is_dismissed")
        .eq("user_id", user.id);
      if (data) setAlertStates(data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const getState = (alertId: string) =>
    alertStates.find((s) => s.alert_id === alertId);

  const enrichedAlerts: EnrichedAlert[] = mockAlerts.map((a) => {
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
    // Optimistic update
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
