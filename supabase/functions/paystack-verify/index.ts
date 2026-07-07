// Verifies a Paystack transaction and activates the user's subscription.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const PAYSTACK = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK) return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY not set" }), { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { reference } = await req.json();
    if (!reference) return new Response(JSON.stringify({ error: "reference required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK}` },
    });
    const j = await r.json();
    const ok = j?.status && j?.data?.status === "success";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const meta = j?.data?.metadata || {};
    const userId = meta?.user_id;
    const plan = meta?.plan;

    if (!ok) {
      if (userId) await supabase.from("user_subscriptions").update({ status: "cancelled" }).eq("paystack_reference", reference);
      return new Response(JSON.stringify({ ok: false, message: j?.data?.gateway_response || "Payment not successful" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (userId && plan) {
      // Deactivate previous active row for this user
      await supabase.from("user_subscriptions").update({ status: "expired" }).eq("user_id", userId).eq("status", "active");
      const expires = new Date(); expires.setMonth(expires.getMonth() + 1);
      // Upsert this pending row → active
      await supabase.from("user_subscriptions")
        .update({ status: "active", activated_at: new Date().toISOString(), expires_at: expires.toISOString() })
        .eq("paystack_reference", reference);
    }

    return new Response(JSON.stringify({ ok: true, plan }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
