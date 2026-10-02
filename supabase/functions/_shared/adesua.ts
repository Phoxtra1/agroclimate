// Adesua — the single AgroClimate payment / entitlement system.
// Every provider (Stripe for cards, Paystack for Mobile Money) records a
// pending row here and only activates access after the provider itself
// has confirmed the payment server-side.
import { createClient } from "npm:@supabase/supabase-js@2";

// One master USD price list. Never trust prices from the browser.
export const PLAN_PRICES_USD: Record<string, number> = {
  freemium: 0,
  pro: 35,
  enterprise: 75,
};

export type Provider = "stripe" | "paystack";

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function requireUser(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return null;
  const { data } = await adminClient().auth.getUser(jwt);
  return data?.user ?? null;
}

export async function recordPending(p: {
  userId: string; plan: string; provider: Provider; reference: string;
  amountUsd: number; currency: string; amountLocal: number;
}) {
  await adminClient().from("user_subscriptions").insert({
    user_id: p.userId, plan: p.plan, status: "pending",
    provider: p.provider, provider_reference: p.reference,
    paystack_reference: p.provider === "paystack" ? p.reference : null,
    amount_usd: p.amountUsd, currency: p.currency, amount_local: p.amountLocal,
  });
}

/**
 * Activates the pending row ONLY when the provider has verified the payment.
 * The plan always comes from our own pending row, never from client input.
 */
export async function activateVerified(provider: Provider, reference: string, verified: boolean) {
  const db = adminClient();
  const { data: row } = await db.from("user_subscriptions")
    .select("id,user_id,plan,status")
    .eq("provider", provider).eq("provider_reference", reference)
    .maybeSingle();
  if (!row) return { ok: false, message: "Payment record not found." };
  if (row.status === "active") return { ok: true, plan: row.plan };
  if (!verified) {
    await db.from("user_subscriptions").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: false, message: "Payment was not confirmed by the provider." };
  }
  await db.from("user_subscriptions").update({ status: "expired" })
    .eq("user_id", row.user_id).eq("status", "active");
  const expires = new Date(); expires.setMonth(expires.getMonth() + 1);
  await db.from("user_subscriptions").update({
    status: "active", activated_at: new Date().toISOString(), expires_at: expires.toISOString(),
  }).eq("id", row.id);
  return { ok: true, plan: row.plan };
}
