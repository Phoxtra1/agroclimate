export const MARKET_UNITS = ["kg", "bags", "tons", "crates", "tuber", "litres", "pieces", "bundles"];

export function parseMarketPrice(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").replace(/,/g, "");
  const match = raw.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function formatMarketPrice(value?: number | null, unit?: string, label?: string | null): string {
  const cleanLabel = (label || "").trim();
  if (cleanLabel) return `${cleanLabel}/${unit || "unit"}`;
  if (!value) return "N/A";
  return `${value}/${unit || "unit"}`;
}
