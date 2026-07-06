// Central catalog of AI models available to Agyenkwa. All are proxied through
// the Lovable AI Gateway via the `odeneho-intelligence` edge function.
export interface AiModelOption {
  id: string;           // stable id used in system_settings
  label: string;        // human-readable name shown in admin dropdown
  gatewayModel: string; // exact Lovable AI Gateway model id
  description: string;
}

export const AI_MODELS: AiModelOption[] = [
  { id: "odeai-1.0",       label: "OdeAI 1.0 (default)",   gatewayModel: "google/gemini-3-flash-preview", description: "Agyenkwa's tuned default — fast, multilingual, agriculture-aware." },
  { id: "gemini-2.5-pro",  label: "Gemini 2.5 Pro",         gatewayModel: "google/gemini-2.5-pro",         description: "Deepest reasoning for cross-module correlation & risk analysis." },
  { id: "gemini-3.5-flash",label: "Gemini 3.5 Flash",       gatewayModel: "google/gemini-3.5-flash",       description: "Balanced speed/quality for high-volume advisories." },
  { id: "gpt-5.5",         label: "OpenAI GPT-5.5",         gatewayModel: "openai/gpt-5.5",                description: "State-of-the-art reasoning for complex operations." },
  { id: "gpt-5",           label: "OpenAI GPT-5",           gatewayModel: "openai/gpt-5",                  description: "Robust all-rounder with strong multimodal support." },
  { id: "gpt-4.1",         label: "OpenAI GPT-4.1",         gatewayModel: "openai/gpt-5-mini",             description: "Cost-efficient GPT tier (routed to GPT-5-mini gateway)." },
];

export const DEFAULT_MODEL = AI_MODELS[0];

export function findModel(id?: string | null): AiModelOption {
  if (!id) return DEFAULT_MODEL;
  return AI_MODELS.find((m) => m.id === id) || DEFAULT_MODEL;
}
