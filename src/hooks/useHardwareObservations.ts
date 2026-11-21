import { useEffect, useMemo, useState } from "react";
import type { DeviceObservation, ObservationMetric } from "@/services/hardware/types";
import { useAuth } from "@/hooks/useAuth";

const HARDWARE_OBSERVATION_EVENT = "agroclimate:device-observation";

/** Receives validated live device observations from the in-browser hardware runtime. */
export function useHardwareObservations(components?: DeviceObservation["component"][]) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [observations, setObservations] = useState<DeviceObservation[]>([]);
  const componentKey = components?.join("|") ?? "";

  useEffect(() => {
    setObservations([]);
    const allowedComponents = componentKey ? componentKey.split("|") as DeviceObservation["component"][] : null;
    if (typeof window === "undefined") return;
    const handleObservation = (event: Event) => {
      const detail = (event as CustomEvent<DeviceObservation>).detail;
      if (!userId || !detail || !detail.eventId || detail.quality !== "valid" || detail.tenantId !== userId) return;
      if (allowedComponents && !allowedComponents.includes(detail.component)) return;
      setObservations((current) => {
        if (current.some((item) => item.eventId === detail.eventId)) return current;
        return [...current, detail].slice(-200);
      });
    };
    window.addEventListener(HARDWARE_OBSERVATION_EVENT, handleObservation);
    return () => window.removeEventListener(HARDWARE_OBSERVATION_EVENT, handleObservation);
  }, [componentKey, userId]);

  const latestByMetric = useMemo(() => {
    const latest = new Map<ObservationMetric, DeviceObservation>();
    for (const item of observations) {
      const prior = latest.get(item.metric);
      if (!prior || Date.parse(item.measuredAt) >= Date.parse(prior.measuredAt)) latest.set(item.metric, item);
    }
    return latest;
  }, [observations]);

  return { observations, latestByMetric };
}
