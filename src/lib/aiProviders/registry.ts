import type { OdenehoProvider } from "./index";
import { lovableProvider } from "./lovableProvider";

// Future providers (local SLM, proprietary fine-tunes, on-device) plug in here.
const providers: Record<string, OdenehoProvider> = {
  "lovable-ai-gateway": lovableProvider,
};

let activeId = "lovable-ai-gateway";

export function getActiveProvider(): OdenehoProvider {
  return providers[activeId] || lovableProvider;
}

export function setActiveProvider(id: string) {
  if (providers[id]) activeId = id;
}

export function listProviders() {
  return Object.values(providers).map((p) => ({ id: p.id }));
}
