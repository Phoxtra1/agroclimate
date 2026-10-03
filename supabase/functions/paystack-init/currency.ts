// Paystack Mobile Money only: converts the master USD price into the
// local currency Paystack must charge in. Not used by the card (Stripe) flow.
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", ZA: "ZAR", KE: "KES", EG: "EGP",
  CI: "XOF", SN: "XOF", BJ: "XOF", TG: "XOF", ML: "XOF", BF: "XOF",
};

export function currencyForCountry(country: string): string {
  const normalized = (country || "").trim().toUpperCase();
  if (normalized === "GHANA") return "GHS";
  if (normalized === "NIGERIA") return "NGN";
  if (normalized === "KENYA") return "KES";
  if (normalized === "SOUTH AFRICA") return "ZAR";
  return COUNTRY_CURRENCY[normalized] || "GHS";
}

export async function getExchangeRate(target: string): Promise<number> {
  if (target === "USD") return 1;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/USD`);
    const j = await r.json();
    return Number(j?.rates?.[target]) || 1;
  } catch { return 1; }
}
