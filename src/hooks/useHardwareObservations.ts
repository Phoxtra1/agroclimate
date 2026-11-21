import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeviceObservation, ObservationMetric } from "@/services/hardware/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const HARDWARE_OBSERVATION_EVENT = "agroclimate:device-observation";

type GatewayObservationRow = {
  id: string;
  device_id: string;
  user_id: string;
  component: DeviceObservation["component"];
  metric: ObservationMetric;
  value: number;
  unit: string;
  observed_at: string;
  received_at: string;
  idempotency_key: string;
  farm_id: string | null;
  site_id: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, string | number | boolean | null> | null;
  device: {
    protocol: DeviceObservation["sourceProtocol"];
    model: string | null;
    firmware_version: string | null;
    status: "active" | "revoked";
    calibration_due_at: string | null;
  } | null;
};

function toDeviceObservation(row: GatewayObservationRow): DeviceObservation | null {
  if (!row.device || row.device.status !== "active" || !row.idempotency_key) return null;
  if (!Number.isFinite(row.value) || !row.observed_at || !row.received_at) return null;

  return {
    eventId: row.idempotency_key,
    deviceId: row.device_id,
    tenantId: row.user_id,
    component: row.component,
    farmId: row.farm_id ?? undefined,
    siteId: row.site_id ?? undefined,
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit,
    measuredAt: row.observed_at,
    receivedAt: row.received_at,
    quality: "valid",
    sourceProtocol: row.device.protocol,
    sourceModel: row.device.model ?? undefined,
    firmwareVersion: row.device.firmware_version ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    metadata: {
      ...(row.metadata ?? {}),
      ...(row.device.calibration_due_at ? {
        calibration_status: "calibrated",
        calibration_due_at: row.device.calibration_due_at,
      } : {}),
    },
  };
}

function mergeObservations(current: DeviceObservation[], incoming: DeviceObservation[]): DeviceObservation[] {
  const byEvent = new Map(current.map((item) => [item.eventId, item]));
  for (const item of incoming) byEvent.set(item.eventId, item);
  return [...byEvent.values()]
    .sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt))
    .slice(-200);
}

/**
 * Reads persisted, server-accepted device observations and listens for new
 * gateway writes. The browser event remains supported for immediate feedback,
 * but is not the source of truth: observations survive refreshes and sessions.
 */
export function useHardwareObservations(components?: DeviceObservation["component"][]) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [observations, setObservations] = useState<DeviceObservation[]>([]);
  const componentKey = components?.join("|") ?? "";

  const loadPersisted = useCallback(async (isCurrent: () => boolean) => {
    if (!userId) {
      if (isCurrent()) setObservations([]);
      return;
    }

    let query = supabase
      .from("agroclimate_device_observations" as any)
      .select("id,device_id,user_id,component,metric,value,unit,observed_at,received_at,idempotency_key,farm_id,site_id,latitude,longitude,metadata,device:agroclimate_devices!inner(protocol,model,firmware_version,status,calibration_due_at)")
      .eq("user_id", userId)
      .order("observed_at", { ascending: false })
      .limit(200);

    const allowedComponents = componentKey
      ? componentKey.split("|") as DeviceObservation["component"][]
      : null;
    if (allowedComponents?.length) query = query.in("component", allowedComponents);

    const { data, error } = await query;
    if (!isCurrent()) return;
    if (error) {
      console.error("Unable to load persisted AgroClimate device observations:", error.message);
      return;
    }

    const rows = (data ?? []) as unknown as GatewayObservationRow[];
    const persisted = rows
      .map(toDeviceObservation)
      .filter((item): item is DeviceObservation => item !== null)
      .filter((item) => item.tenantId === userId);
    setObservations((current) => mergeObservations(current, persisted));
  }, [componentKey, userId]);

  useEffect(() => {
    let active = true;
    const isCurrent = () => active && userId !== null;
    setObservations([]);

    const allowedComponents = componentKey
      ? componentKey.split("|") as DeviceObservation["component"][]
      : null;

    const handleObservation = (event: Event) => {
      const detail = (event as CustomEvent<DeviceObservation>).detail;
      if (!userId || !detail || !detail.eventId || detail.quality !== "valid" || detail.tenantId !== userId) return;
      if (allowedComponents && !allowedComponents.includes(detail.component)) return;
      setObservations((current) => mergeObservations(current, [detail]));
    };

    if (typeof window !== "undefined") {
      window.addEventListener(HARDWARE_OBSERVATION_EVENT, handleObservation);
    }

    void loadPersisted(isCurrent);

    const channel = userId
      ? supabase.channel(`hardware-observations-${userId}-${componentKey || "all"}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "agroclimate_device_observations",
          filter: `user_id=eq.${userId}`,
        }, () => { void loadPersisted(isCurrent); })
        .subscribe()
      : null;

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener(HARDWARE_OBSERVATION_EVENT, handleObservation);
      }
      if (channel) void supabase.removeChannel(channel);
    };
  }, [componentKey, loadPersisted, userId]);

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
