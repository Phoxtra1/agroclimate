// Verifies a Stripe Checkout Session with Stripe, then activates via Adesua.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { activateVerified, PLAN_PRICES_USD } from "../_shared/adesua.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const STRIPE = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE) return json({ error: "Card payments are not configured yet." }, 501);
  try {
    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string") return json({ error: "session_id required" }, 400);
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`, {
      headers: { Authorization: `Bearer ${STRIPE}` },
    });
    const s = await r.json();
    if (!r.ok) return json({ ok: false, message: s?.error?.message || "Could not confirm card payment." });
    const plan = s?.metadata?.plan;
    const expected = Math.round((PLAN_PRICES_USD[plan] ?? -1) * 100);
    const verified = s.payment_status === "paid" && s.status === "complete" && (s.currency_conversion?.amount_subtotal ?? s.amount_subtotal) === expected;
    if (!verified && s.status === "open") return json({ ok: false, pending: true, message: "Payment is still being confirmed." });
    return json(await activateVerified("stripe", session_id, verified));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
