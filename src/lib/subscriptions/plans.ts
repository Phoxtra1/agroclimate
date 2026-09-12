// Central plan / component-access map. USD prices only.
export type PremiumComponent =
  | "ai_assistant"
  | "agro_forecast"
  | "agro_inventory"
  | "agro_risk"
  | "market_link"
  | "post_harvest"
  | "agnav"
  | "flight_advisory"
  | "handler"
  | "agtrans"
  | "agyenkwa_api";

export type PlanId = "freemium" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  tagline: string;
  features: string[];
  components: PremiumComponent[]; // components UNLOCKED by this plan
}

export const PLANS: Plan[] = [
  {
    id: "freemium",
    name: "Freemium",
    priceUsd: 0,
    tagline: "Get started with dashboard essentials.",
    features: [
      "Dashboard Alerts",
      "Weather Overview",
      "Environmental Alerts",
      "Limited AI Assistant Preview",
    ],
    components: [],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 35,
    tagline: "Everyday tools for active farmers.",
    features: [
      "Full AI Assistant",
      "Handler",
      "Post-Harvest Tracker",
      "Market Link",
      "SMS Alerts",
    ],
    components: ["ai_assistant", "handler", "post_harvest", "market_link"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: 75,
    tagline: "Everything in Pro plus advanced intelligence & flight.",
    features: [
      "Everything in Pro",
      "Agro Inventory",
      "Agro Forecast",
      "AgroRisk",
      "Flight Advisory",
      "Multi-user Access",
      "AGNav",
      "AGTrans",
    ],
    components: [
      "ai_assistant", "handler", "post_harvest", "market_link",
      "agro_inventory", "agro_forecast", "agro_risk",
      "flight_advisory", "agnav", "agtrans",
    ],
  },
];

export const COMPONENT_LABELS: Record<PremiumComponent, string> = {
  ai_assistant: "AI Assistant",
  agro_forecast: "Agro Forecast",
  agro_inventory: "Agro Inventory",
  agro_risk: "AgroRisk",
  market_link: "Market Link",
  post_harvest: "Post-Harvest Tracker",
  agnav: "AGNav",
  flight_advisory: "Flight Advisory",
  handler: "Handler",
  agtrans: "AGTrans",
  agyenkwa_api: "AgroClimate API",
};

export function planAllows(planId: PlanId | null | undefined, comp: PremiumComponent) {
  if (!planId) return false;
  const p = PLANS.find(x => x.id === planId);
  return !!p?.components.includes(comp);
}
