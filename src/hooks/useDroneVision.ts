import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VisionDetection {
  category: string;
  observation: string;
  risk_score: number;
  recommended_action: string;
  confidence: "low" | "moderate" | "high";
}
export interface VisionFindings {
  overall_health_score: number;
  summary: string;
  detections: VisionDetection[];
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function useDroneVision() {
  const [findings, setFindings] = useState<VisionFindings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = async (file: File, missionId?: string) => {
    setLoading(true); setError(null);
    try {
      const imageBase64 = await fileToBase64(file);
      const { data, error: invErr } = await supabase.functions.invoke("odeneho-vision", {
        body: { imageBase64, context: { source: "drone-upload" } },
      });
      if (invErr) throw new Error(invErr.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const f: VisionFindings | null = (data as any)?.findings || null;
      setFindings(f);

      // Persist detections
      const { data: { user } } = await supabase.auth.getUser();
      if (f && user) {
        await supabase.from("drone_ai_detections").insert(
          f.detections.map((d) => ({
            user_id: user.id, mission_id: missionId ?? null,
            category: d.category, observation: d.observation,
            risk_score: d.risk_score, recommended_action: d.recommended_action,
          }))
        );
      }
      return f;
    } catch (e: any) {
      setError(e.message || "Vision analysis failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeBase64 = async (imageBase64: string, missionId?: string) => {
    setLoading(true); setError(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("odeneho-vision", {
        body: { imageBase64, context: { source: "drone-frame" } },
      });
      if (invErr) throw new Error(invErr.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const f: VisionFindings | null = (data as any)?.findings || null;
      setFindings(f);
      return f;
    } catch (e: any) {
      setError(e.message || "Vision analysis failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { findings, loading, error, analyzeFile, analyzeBase64 };
}
