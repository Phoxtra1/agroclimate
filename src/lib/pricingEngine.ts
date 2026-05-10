export type PriceCurrency = "GHS" | "NGN" | "USD" | "KES" | "XOF" | "EUR" | (string & {});

export interface SupplyLike {
  crop_name: string;
  region?: string | null;
  category?: string | null;
  expected_quantity?: number | null;
  unit?: string | null;
  suggested_price?: number | null;
  price_label?: string | null;
  status?: string | null;
}

export interface DemandLike {
  crop_name: string;
  region?: string | null;
  quantity_needed?: number | null;
  unit?: string | null;
  target_price?: number | null;
  status?: string | null;
}

export interface PricingInput {
  cropName: string;
  region?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  existingSupply?: SupplyLike[];
  activeBuyerRequests?: DemandLike[];
  currency?: PriceCurrency;
}

export interface PricingResult {
  estimatedPrice: number;
  priceLabel: string;
  demandLevel: "Low" | "Moderate" | "High" | "Very High";
  marketActivity: "Quiet" | "Active" | "Hot";
  supplyCount: number;
  demandCount: number;
  basis: "history" | "demand" | "floor";
  explain: string;
}

/* --- helpers ---------------------------------------------------- */

const norm = (s?: string | null) => (s || "").trim().toLowerCase();
const sameCrop = (a?: string | null, b?: string | null) => norm(a) === norm(b);
const sameRegion = (a?: string | null, b?: string | null) => {
  const x = norm(a); const y = norm(b);
  if (!x || !y) return true;            // missing region = wildcard match
  return x === y || x.includes(y) || y.includes(x);
};

function median(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Conservative floor by category — keeps weird inputs out of the negative. */
function categoryFloor(category?: string | null): number {
  switch (norm(category)) {
    case "livestock": return 200;
    case "fish":      return 80;
    case "mineral":   return 50;
    case "raw material":
    case "refined material": return 20;
    case "fruit":
    case "vegetable":
    case "tuber":     return 5;
    case "cereal":
    case "legume":    return 8;
    default:          return 1;
  }
}

/* --- main engine ------------------------------------------------- */

export function estimateMarketPrice(input: PricingInput): PricingResult {
  const supply  = (input.existingSupply || []).filter((s) =>
    sameCrop(s.crop_name, input.cropName) && sameRegion(s.region, input.region)
    && (s.status || "active") !== "cancelled"
  );
  const demand  = (input.activeBuyerRequests || []).filter((d) =>
    sameCrop(d.crop_name, input.cropName) && sameRegion(d.region, input.region)
    && (d.status || "active") !== "cancelled"
  );

  const supplyCount = supply.length;
  const demandCount = demand.length;

  // Establish baseline price.
  const histMedian   = median(supply.map((s) => Number(s.suggested_price || 0)));
  const demandMedian = median(demand.map((d) => Number(d.target_price || 0)));

  let basis: PricingResult["basis"] = "floor";
  let baseline = 0;
  if (histMedian > 0) {
    baseline = histMedian; basis = "history";
  } else if (demandMedian > 0) {
    baseline = demandMedian; basis = "demand";
  } else {
    baseline = categoryFloor(input.category) * 10;
    basis = "floor";
  }

  // Demand vs supply ratio drives a multiplier roughly in [0.75, 1.4].
  const ratio = (demandCount + 1) / (supplyCount + 1);
  let demandMultiplier = 1;
  let demandLevel: PricingResult["demandLevel"] = "Moderate";
  if (ratio >= 2.5)      { demandMultiplier = 1.40; demandLevel = "Very High"; }
  else if (ratio >= 1.5) { demandMultiplier = 1.20; demandLevel = "High"; }
  else if (ratio >= 0.8) { demandMultiplier = 1.00; demandLevel = "Moderate"; }
  else                   { demandMultiplier = 0.85; demandLevel = "Low"; }

  // Quantity penalty for very large lots — discourage flooding the market.
  const qty = Number(input.quantity || 0);
  let qtyMultiplier = 1;
  if (qty > 10_000)      qtyMultiplier = 0.92;
  else if (qty > 1_000)  qtyMultiplier = 0.97;

  const raw = Math.max(categoryFloor(input.category), baseline * demandMultiplier * qtyMultiplier);
  const estimatedPrice = Math.round(raw * 100) / 100;

  const activityScore = supplyCount + demandCount;
  const marketActivity: PricingResult["marketActivity"] =
    activityScore >= 8 ? "Hot" : activityScore >= 3 ? "Active" : "Quiet";

  const currency = input.currency || "GHS";
  const priceLabel = `${currency} ${estimatedPrice.toLocaleString()}${input.unit ? ` / ${input.unit}` : ""}`;

  const explain =
    basis === "history" ? `Based on ${supplyCount} similar supplier listings`
    : basis === "demand" ? `Derived from ${demandCount} active buyer requests`
    : `No history yet — using a category floor estimate`;

  return {
    estimatedPrice,
    priceLabel,
    demandLevel,
    marketActivity,
    supplyCount,
    demandCount,
    basis,
    explain,
  };
}
