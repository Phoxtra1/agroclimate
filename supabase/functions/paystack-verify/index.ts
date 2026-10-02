// Verifies a Paystack transaction with Paystack, then activates via Adesua.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { activateVerified } from "../_shared/adesua.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const PAYSTACK = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!PAYSTACK) return json({ error: "Mobile Money is not configured yet." }, 501);
  try {
    const { reference } = await req.json();
    if (!reference) return json({ error: "reference required" }, 400);
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK}` },
    });
    const j = await r.json();
    const verified = r.ok && j?.status === true && j?.data?.status === "success" && j?.data?.reference === reference;
    if (!verified && j?.data?.status && ["pending", "ongoing", "processing"].includes(j.data.status)) {
      return json({ ok: false, pending: true, message: "Payment is still being confirmed." });
    }
    return json(await activateVerified("paystack", reference, verified));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
