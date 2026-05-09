import { supabase } from "@/integrations/supabase/client";

export type NegotiationStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "declined"
  | "completed";

export interface NegotiationRow {
  id: string;
  listing_id: string | null;
  order_id: string | null;
  buyer_id: string;
  supplier_id: string;
  status: NegotiationStatus;
  agreed_price: number | null;
  agreed_quantity: number | null;
  unit: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------- transition guard ----------------------------------- */

const ALLOWED: Record<NegotiationStatus, NegotiationStatus[]> = {
  pending:     ["negotiating", "declined"],
  negotiating: ["accepted", "declined"],
  accepted:    ["completed"],
  declined:    [],            // terminal for this thread
  completed:   [],            // terminal
};

export function canTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

/* ---------- guards --------------------------------------------- */

export function assertDifferentParties(buyerId: string, supplierId: string) {
  if (!buyerId || !supplierId || buyerId === supplierId) {
    throw new Error("Negotiation requires two different parties.");
  }
}

/* ---------- supabase wrappers ---------------------------------- */

export interface OpenNegotiationInput {
  buyerId: string;
  supplierId: string;
  listingId?: string;
  orderId?: string;
  agreedPrice?: number;
  agreedQuantity?: number;
  unit?: string;
}

/** Create or fetch the negotiation row for this (buyer, supplier, listing/order) tuple. */
export async function openNegotiation(input: OpenNegotiationInput): Promise<NegotiationRow> {
  assertDifferentParties(input.buyerId, input.supplierId);

  // Look for an existing active thread first.
  const { data: existing } = await supabase
    .from("negotiations" as any)
    .select("*")
    .eq("buyer_id", input.buyerId)
    .eq("supplier_id", input.supplierId)
    .eq(input.listingId ? "listing_id" : "order_id", input.listingId || input.orderId || "")
    .in("status", ["pending", "negotiating"])
    .order("created_at", { ascending: false })
    .limit(1);
  const found = (existing as any as NegotiationRow[])?.[0];
  if (found) return found;

  const { data, error } = await supabase
    .from("negotiations" as any)
    .insert({
      buyer_id: input.buyerId,
      supplier_id: input.supplierId,
      listing_id: input.listingId || null,
      order_id: input.orderId || null,
      status: "pending",
      agreed_price: input.agreedPrice ?? null,
      agreed_quantity: input.agreedQuantity ?? null,
      unit: input.unit ?? null,
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as any as NegotiationRow;
}

export async function setNegotiationStatus(
  negotiationId: string,
  current: NegotiationStatus,
  next: NegotiationStatus,
  patch: Partial<Pick<NegotiationRow, "agreed_price" | "agreed_quantity" | "unit">> = {},
): Promise<NegotiationRow> {
  if (!canTransition(current, next)) {
    throw new Error(`Cannot move negotiation from ${current} → ${next}`);
  }
  const { data, error } = await supabase
    .from("negotiations" as any)
    .update({ status: next, ...patch, updated_at: new Date().toISOString() } as any)
    .eq("id", negotiationId)
    .select("*")
    .single();
  if (error) throw error;
  return data as any as NegotiationRow;
}

/**
 * Accept a negotiation AND create the matching agreement row in one logical step.
 * The contract card lives in `Agreement.tsx`, fed by the `agreements` table.
 */
export async function acceptNegotiation(
  negotiation: NegotiationRow,
  finalize: { agreedPrice: number; agreedQuantity: number; unit: string; deliveryTerms?: string },
): Promise<{ negotiation: NegotiationRow; agreementId: string }> {
  const updated = await setNegotiationStatus(negotiation.id, negotiation.status, "accepted", {
    agreed_price: finalize.agreedPrice,
    agreed_quantity: finalize.agreedQuantity,
    unit: finalize.unit,
  });

  const { data: agreement, error } = await supabase
    .from("agreements" as any)
    .insert({
      negotiation_id: negotiation.id,
      buyer_id: negotiation.buyer_id,
      supplier_id: negotiation.supplier_id,
      listing_id: negotiation.listing_id,
      order_id: negotiation.order_id,
      agreed_price: finalize.agreedPrice,
      agreed_quantity: finalize.agreedQuantity,
      unit: finalize.unit,
      delivery_terms: finalize.deliveryTerms || null,
      agreement_status: "active",
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return { negotiation: updated, agreementId: (agreement as any).id };
}

/** Decline THIS thread only — buyer order / supplier listing remains active. */
export function declineNegotiation(negotiation: NegotiationRow) {
  return setNegotiationStatus(negotiation.id, negotiation.status, "declined");
}

export function statusBadgeTone(status: NegotiationStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
    case "completed":  return "default";
    case "declined":   return "destructive";
    case "negotiating":return "secondary";
    default:           return "outline";
  }
}
