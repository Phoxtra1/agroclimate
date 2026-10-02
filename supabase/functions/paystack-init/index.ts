// Sikasem → Mobile Money → Paystack. Records a pending Adesua row.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PLAN_PRICES_USD, recordPending, requireUser } from "../_shared/adesua.ts";
import { currencyForCountry, getExchangeRate } from "./currency.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const PAYSTACK = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK) return json({ error: "Mobile Money is not configured yet." }, 501);

  try {
    const user = await requireUser(req);
    if (!user?.email) return json({ error: "Please sign in first." }, 401);
    const { plan, return_path } = await req.json();
    const priceUsd = PLAN_PRICES_USD[plan];
    if (!priceUsd) return json({ error: "Unknown or free plan" }, 400);

    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-country") || "";
    const currency = currencyForCountry(country);
    const rate = await getExchangeRate(currency);
    const amountLocal = priceUsd * rate;
    const reference = `agy_${plan}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const origin = req.headers.get("origin") || "https://agro.amineva.com";
    const callback_url = `${origin}/subscription/verify?provider=paystack&reference=${reference}&return=${encodeURIComponent(return_path || "/dashboard")}`;

    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: Math.round(amountLocal * 100), currency, reference, callback_url,
        channels: ["mobile_money"],
        metadata: { plan, user_id: user.id, price_usd: priceUsd, rate },
      }),
    });
    const j = await r.json();
    if (!r.ok || !j?.status) {
      console.error(`Paystack init failed [${r.status}]`, j);
      return json({ error: j?.message || "Paystack init failed" }, 400);
    }
    await recordPending({ userId: user.id, plan, provider: "paystack", reference, amountUsd: priceUsd, currency, amountLocal });
    return json({ authorization_url: j.data.authorization_url, reference });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
