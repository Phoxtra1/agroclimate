import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DroneTelemetry, FlightStatus } from "@/lib/drone/types";

export interface FlightAdvisoryAlert { type: string; severity: "info" | "warning" | "critical"; message: string; }
export interface FlightAdvisory {
  safety_score: number;
  status: "safe" | "caution" | "return_home" | "emergency_land";
  summary: string;
  primary_recommendation: string;
  alerts: FlightAdvisoryAlert[];
  route_optimization?: string;
}

export function useFlightAdvisor(args: {
  telemetry: DroneTelemetry;
  environment: any;
  status: FlightStatus;
  mission?: Record<string, unknown>;
  intervalMs?: number;
}) {
  const { telemetry, environment, status, mission, intervalMs = 30000 } = args;
  const [advisory, setAdvisory] = useState<FlightAdvisory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const evaluate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("odeneho-flight-ops", {
        body: { telemetry, environment, mission },
      });
      if (invErr) throw new Error(invErr.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.advisory) setAdvisory((data as any).advisory);
    } catch (e: any) {
      setError(e.message || "Advisory unavailable");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (status !== "flying" && status !== "returning") return;
    evaluate();
    const t = setInterval(evaluate, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return { advisory, loading, error, evaluate };
}
