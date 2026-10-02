// Sikasem → Card → Stripe Checkout. Charges the master USD price; Stripe
// presents local currency where the account supports it (Adaptive Pricing).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PLAN_PRICES_USD, recordPending, requireUser } from "../_shared/adesua.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const STRIPE = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE) return json({ error: "Card payments are not configured yet." }, 501);
  try {
    const user = await requireUser(req);
    if (!user?.email) return json({ error: "Please sign in first." }, 401);
    const { plan, return_path } = await req.json();
    const priceUsd = PLAN_PRICES_USD[plan];
    if (!priceUsd) return json({ error: "Unknown or free plan" }, 400);

    const origin = req.headers.get("origin") || "https://agro.amineva.com";
    const ret = encodeURIComponent(return_path || "/dashboard");
    const form = new URLSearchParams({
      mode: "payment",
      customer_email: user.email,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(priceUsd * 100)),
      "line_items[0][price_data][product_data][name]": `AgroClimate ${plan[0].toUpperCase() + plan.slice(1)} — 1 month`,
      "payment_method_types[0]": "card",
      client_reference_id: user.id,
      "metadata[user_id]": user.id,
      "metadata[plan]": plan,
      success_url: `${origin}/subscription/verify?provider=stripe&session_id={CHECKOUT_SESSION_ID}&return=${ret}`,
      cancel_url: `${origin}/subscription/pay?plan=${plan}&return=${ret}`,
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const s = await r.json();
    if (!r.ok) {
      console.error(`Stripe checkout failed [${r.status}]`, s);
      return json({ error: s?.error?.message || "Card checkout could not start." }, 400);
    }
    await recordPending({ userId: user.id, plan, provider: "stripe", reference: s.id, amountUsd: priceUsd, currency: "USD", amountLocal: priceUsd });
    return json({ url: s.url });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
