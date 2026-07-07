// Initialises a Paystack transaction for an Agyenkwa subscription.
// - Loads USD plan price from the plans table below.
// - Converts USD → user's local Paystack-supported currency (backend-only).
// - Falls back to USD when the user's country isn't Paystack-supported.
// - Returns { authorization_url, reference } for the frontend to redirect to.
//
// Requires PAYSTACK_SECRET_KEY. Currency conversion uses open.er-api.com.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PLAN_PRICES_USD: Record<string, number> = {
  freemium: 0,
  pro: 35,
  enterprise: 75,
  institutional: 250,
};

// Paystack officially settles in: NGN, GHS, ZAR, KES, USD, EGP, XOF.
// We infer currency from the caller's country via Cloudflare or IP fallback.
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", ZA: "ZAR", KE: "KES", EG: "EGP",
  CI: "XOF", SN: "XOF", BJ: "XOF", TG: "XOF", ML: "XOF", BF: "XOF",
};

async function getExchangeRate(target: string): Promise<number> {
  if (target === "USD") return 1;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/USD`);
    const j = await r.json();
    return Number(j?.rates?.[target]) || 1;
  } catch { return 1; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PAYSTACK = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK) {
    return new Response(JSON.stringify({ error: "Paystack is not configured. Add PAYSTACK_SECRET_KEY to enable payments." }), {
      status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { plan, email, return_path } = await req.json();
    if (!plan || !email) {
      return new Response(JSON.stringify({ error: "plan and email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const priceUsd = PLAN_PRICES_USD[plan];
    if (priceUsd === undefined) return new Response(JSON.stringify({ error: "Unknown plan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (priceUsd === 0) return new Response(JSON.stringify({ authorization_url: null, message: "Free plan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Resolve auth user
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const userId = userData?.user?.id;

    // Detect country → currency
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-country") || "";
    const currency = COUNTRY_CURRENCY[country.toUpperCase()] || "USD";
    const rate = await getExchangeRate(currency);
    const amountLocal = priceUsd * rate;
    // Paystack expects the smallest currency unit
    const amountMinor = Math.round(amountLocal * 100);

    const reference = `agy_${plan}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const origin = req.headers.get("origin") || "https://agro.amineva.com";
    const callback_url = `${origin}/subscription/verify?reference=${reference}&return=${encodeURIComponent(return_path || "/dashboard")}`;

    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email, amount: amountMinor, currency, reference, callback_url,
        metadata: { plan, user_id: userId, price_usd: priceUsd, rate },
      }),
    });
    const j = await r.json();
    if (!j?.status) {
      return new Response(JSON.stringify({ error: j?.message || "Paystack init failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Record pending row
    if (userId) {
      await supabase.from("user_subscriptions").insert({
        user_id: userId, plan, status: "pending", paystack_reference: reference,
        amount_usd: priceUsd, currency, amount_local: amountLocal,
      });
    }

    return new Response(JSON.stringify({ authorization_url: j.data.authorization_url, reference }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
