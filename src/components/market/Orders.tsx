import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Search, MapPin, Calendar, Pencil, Trash2, Save,
  Handshake, CheckCircle2, XCircle, MessageCircle, X, Navigation, Truck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";
import { ChatPanel } from "./ChatPanel";
import {
  openNegotiation, acceptNegotiation, declineNegotiation,
} from "@/lib/negotiationEngine";
import { useAGTrans } from "@/hooks/useAGTrans";

export interface OrderRow {
  id: string; buyer_id: string; buyer_name: string | null; crop_name: string;
  region: string | null; quantity_needed: number; unit: string;
  target_price: number; price_label?: string | null;
  delivery_start: string | null; delivery_end: string | null;
  status: string; order_status?: string | null;
  quality: string | null; grade: string | null; moisture: string | null;
  contact_email: string | null; contact_phone: string | null;
  notes: string | null; created_at: string;
}

/* ============================================================== */
/*  PlaceOrderForm — buyer submits demand                          */
/* ============================================================== */
export function PlaceOrderForm({ onPlaced }: { onPlaced?: () => void }) {
  const { user } = useAuth();
  const [product, setProduct] = useState("");
  const [region, setRegion] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [quality, setQuality] = useState("");
  const [grade, setGrade] = useState("");
  const [moisture, setMoisture] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to post buyer demand"); return; }
    if (!product.trim() || !qty || !price.trim()) { toast.error("Product, quantity and target price required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("buyer_orders").insert({
        buyer_id: user.id,
        buyer_name: name || user.email || null,
        crop_name: product.trim(),
        region: region || null,
        quantity_needed: Number(qty),
        unit,
        target_price: parseMarketPrice(price),
        price_label: price.trim() || null,
        delivery_start: start || null,
        delivery_end: end || null,
        quality: quality || null,
        grade: grade || null,
        moisture: moisture || null,
        contact_email: email || user.email || null,
        contact_phone: phone || null,
        notes: notes || null,
        order_status: "active",
      });
      if (error) throw error;
      toast.success("Order posted to Market Link");
      setProduct(""); setQty(""); setPrice(""); setNotes("");
      onPlaced?.();
    } catch (err) { toast.error((err as Error).message || "Failed to place order"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><Label>Buyer / company name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your business" /></div>
      <div><Label>Product needed</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Crop, livestock, fish, mineral, raw/refined material" required /></div>
      <div><Label>Quantity</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Quality (e.g. fresh, dried)</Label><Input value={quality} onChange={(e) => setQuality(e.target.value)} /></div>
      <div><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / B / C" /></div>
      <div><Label>Moisture %</Label><Input value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="e.g. ≤ 14%" /></div>
      <div><Label>Target price / {unit}</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="GHS 250, USD 40, ₦15000" required /></div>
      <div><Label>Delivery region / location</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Delivery from</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Delivery to</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Additional notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="w-full h-11">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Order"}</Button></div>
    </form>
  );
}

/* ============================================================== */
/*  Shared query hook.                                              */
/*  scope="marketplace" → demand from OTHER buyers (supplier view). */
/*  scope="mine"        → ONLY current buyer's own orders.          */
/*  scope="all"         → legacy alias for mine; never mixed here.   */
/* ============================================================== */
type Scope = "marketplace" | "mine" | "all" | "global";

function useOrders(scope: Scope) {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("buyer_orders")
        .select("*")
        .neq("status", "cancelled")
        .neq("crop_name", "Yam")
        .order("created_at", { ascending: false })
        .limit(200);

      if (scope === "mine" || scope === "all") {
        if (!user) { setItems([]); setLoading(false); return; }
        query = query.eq("buyer_id", user.id);
      } else if (scope === "marketplace" && user) {
        query = query.neq("buyer_id", user.id);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("[useOrders] Fetch error:", error);
      } else {
        setItems((data as unknown as OrderRow[]) || []);
      }
    } catch (err) {
      console.error("[useOrders] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`orders-${scope}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, scope]);

  return { items, loading, reload: load };
}

/* ============================================================== */
/*  OrderListing — ownership-aware single component.                */
/*    • scope="marketplace" (default) → dashboard supplier view.    */
/*        Modal: Negotiate / Accept / Decline (read-only).          */
/*    • scope="mine"  → buyer's Place Order page (only own orders). */
/*        Modal: Edit / Save / Delete.                              */
/*    • scope="all"   → legacy buyer page alias, treated as mine.  */
/* ============================================================== */
export function OrderListing({ scope = "global" }: { scope?: Scope } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deliveryJobs, trackingSessions, confirmDelivery } = useAGTrans();
  const { items, loading, reload } = useOrders(scope);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Edit-mode state for owner modal
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>({});

  const isOwner = !!user && !!selected && selected.buyer_id === user.id;
  const isBuyerManagementContext = scope === "mine" || scope === "all";
  const showBuyerOwnerActions = (isOwner && scope !== "global") || isBuyerManagementContext;

  // Reset edit state whenever the modal opens/closes or selection changes.
  useEffect(() => {
    if (selected) {
      setEditing(false);
      setDraft({ ...selected, price_label: selected.price_label || String(selected.target_price || "") });
    } else {
      setEditing(false);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

  /* ---------- Supplier actions (non-owner) ---------- */
  const openNegotiate = () => {
    if (!selected || !user) { toast.error("Sign in to negotiate"); return; }
    setChatOpen(true);
  };

  const acceptOrder = async () => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      const negotiation = await openNegotiation({
        buyerId: selected.buyer_id, supplierId: user.id, orderId: selected.id,
        unit: selected.unit, agreedPrice: Number(selected.target_price || 0),
        agreedQuantity: Number(selected.quantity_needed || 0),
      });
      await acceptNegotiation(negotiation, {
        agreedPrice: Number(selected.target_price || 0),
        agreedQuantity: Number(selected.quantity_needed || 0),
        unit: selected.unit,
      });
      toast.success("Accepted — agreement generated");
      reload();
      setSelected(null);
    } catch (e) { toast.error((e as Error).message || "Could not accept"); }
    finally { setBusy(false); }
  };

  const declineOrder = async () => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      const negotiation = await openNegotiation({
        buyerId: selected.buyer_id, supplierId: user.id, orderId: selected.id,
      });
      await declineNegotiation(negotiation);
      toast.info("Declined for you — order stays active for other suppliers.");
      setSelected(null);
    } catch (e) { toast.error((e as Error).message || "Could not decline"); }
    finally { setBusy(false); }
  };

  /* ---------- Owner actions (buyer of this order) ---------- */
  const saveOwnerEdit = async () => {
    if (!user || !selected) return;
    setSaving(true);
    try {
      const label = String(draft.price_label || "").trim();
      const patch = {
        crop_name: String(draft.crop_name || "").trim(),
        region: draft.region || null,
        quantity_needed: Number(draft.quantity_needed || 0),
        unit: draft.unit || "kg",
        target_price: parseMarketPrice(label),
        price_label: label || null,
        quality: draft.quality || null,
        grade: draft.grade || null,
        moisture: draft.moisture || null,
        delivery_start: draft.delivery_start || null,
        delivery_end: draft.delivery_end || null,
        notes: draft.notes || null,
      };
      const { error } = await supabase.from("buyer_orders")
        .update(patch).eq("id", selected.id).eq("buyer_id", user.id);
      if (error) throw error;
      toast.success("Order updated");
      setEditing(false);
      reload();
      setSelected(null);
    } catch (e) { toast.error((e as Error).message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteOwn = async () => {
    if (!user || !selected) return;
    if (!window.confirm("Delete this order? This cannot be undone.")) return;
    const { error } = await supabase.from("buyer_orders")
      .delete().eq("id", selected.id).eq("buyer_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order deleted");
    reload();
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search buyer orders" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No buyer orders yet.</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map((o) => {
            const mine = !!user && o.buyer_id === user.id;
            return (
              <Card key={o.id} className="hover:shadow-md transition cursor-pointer" onClick={() => { setSelected(o); setChatOpen(false); }}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{o.crop_name}</div>
                    <div className="text-sm font-semibold text-primary whitespace-nowrap">{formatMarketPrice(o.target_price, o.unit, o.price_label)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">Need {Number(o.quantity_needed).toLocaleString()} {o.unit}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{o.region || "Anywhere"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Deliver {o.delivery_start || "?"} → {o.delivery_end || "?"}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {o.grade && <Badge variant="outline" className="text-[10px]">Grade {o.grade}</Badge>}
                    {o.quality && <Badge variant="outline" className="text-[10px]">{o.quality}</Badge>}
                    {mine
                      ? <Badge className="text-[10px]">Your order</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Buyer demand</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}</div>}

      {/* ============================================================
          UNIFIED MODAL — branches by ownership.
          Buyer page / owner → Edit / Save / Delete.
          Public listing     → Negotiate / Accept / Decline.
          ============================================================ */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <DialogTitle>
                {selected.crop_name} — {showBuyerOwnerActions ? "your order" : `buyer · ${selected.buyer_name || "Buyer"}`}
              </DialogTitle>
            </DialogHeader>

            {/* ----- OWNER VIEW ----- */}
            {showBuyerOwnerActions ? (
              editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2"><Label>Product</Label>
                    <Input value={String(draft.crop_name || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, crop_name: e.target.value }))} />
                  </div>
                  <div><Label>Quantity</Label>
                    <Input type="number" value={String(draft.quantity_needed ?? "")}
                      onChange={(e) => setDraft((d) => ({ ...d, quantity_needed: Number(e.target.value) }))} />
                  </div>
                  <div><Label>Unit</Label>
                    <Select value={String(draft.unit || "kg")} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Target price</Label>
                    <Input value={String(draft.price_label || "")} placeholder="GHS 150"
                      onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} />
                  </div>
                  <div><Label>Region</Label>
                    <Input value={String(draft.region || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} />
                  </div>
                  <div><Label>Quality</Label>
                    <Input value={String(draft.quality || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, quality: e.target.value }))} />
                  </div>
                  <div><Label>Grade</Label>
                    <Input value={String(draft.grade || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value }))} />
                  </div>
                  <div><Label>Moisture</Label>
                    <Input value={String(draft.moisture || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, moisture: e.target.value }))} />
                  </div>
                  <div><Label>Delivery from</Label>
                    <Input type="date" value={String(draft.delivery_start || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, delivery_start: e.target.value }))} />
                  </div>
                  <div><Label>Delivery to</Label>
                    <Input type="date" value={String(draft.delivery_end || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, delivery_end: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2"><Label>Notes</Label>
                    <Textarea rows={2} value={String(draft.notes || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
                    <Button variant="outline" onClick={() => { setEditing(false); setDraft(selected); }}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                    <Button onClick={saveOwnerEdit} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <I label="Buyer" v={selected.buyer_name || "You"} />
                    <I label="Quantity" v={`${Number(selected.quantity_needed).toLocaleString()} ${selected.unit}`} />
                    <I label="Target price" v={formatMarketPrice(selected.target_price, selected.unit, selected.price_label)} />
                    <I label="Region" v={selected.region || "N/A"} />
                    <I label="Quality" v={selected.quality || "N/A"} />
                    <I label="Grade" v={selected.grade || "N/A"} />
                    <I label="Moisture" v={selected.moisture || "N/A"} />
                    <I label="Delivery" v={`${selected.delivery_start || "?"} → ${selected.delivery_end || "?"}`} />
                  </div>
                  {selected.notes && <p className="text-sm text-muted-foreground border-t pt-2">{selected.notes}</p>}

                  {/* Shipment Tracking details */}
                  {(() => {
                    const matchedJob = deliveryJobs.find(
                      j => j.product.toLowerCase() === selected.crop_name.toLowerCase() &&
                      (j.buyer_id === user?.id || j.supplier_id === user?.id || j.driver_id === user?.id) &&
                      j.status !== "Cancelled"
                    );
                    if (!matchedJob) return null;
                    const session = trackingSessions.find(s => s.delivery_job_id === matchedJob.id);
                    const active = matchedJob.status !== "Completed" && matchedJob.status !== "Delivered" && matchedJob.status !== "Cancelled";
                    return (
                      <div className="mt-4 border-t pt-4 space-y-2">
                        <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Truck className="h-4 w-4 text-primary" /> Shipment Tracking Details
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <I label="Driver" v={matchedJob.driver_name || "Assigned"} />
                          <I label="Vehicle" v={`${matchedJob.vehicle_type || "—"} · ${matchedJob.plate_number || "—"}`} />
                          <I label="Status" v={matchedJob.status} />
                          <I label="ETA" v={session?.eta || "Calculating…"} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {active && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-xs font-bold"
                              onClick={() => navigate(`/live-tracking/${matchedJob.id}`)}
                            >
                              <Navigation className="h-3.5 w-3.5 mr-1" /> Track Shipment
                            </Button>
                          )}
                          {matchedJob.status === "Delivered" && (
                            <Button size="sm" onClick={async () => { try { await confirmDelivery(matchedJob.request_id || matchedJob.id); toast.success("Delivery confirmed"); } catch { toast.error("Could not confirm"); } }}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Delivery
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => toast.info("Issue reported. Support will contact you.")}>
                            Report Issue
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 flex-wrap pt-2">
                    {scope !== "marketplace" && (
                      <>
                        <Button variant="outline" onClick={() => setEditing(true)}>
                          <Pencil className="h-4 w-4 mr-1" />Edit
                        </Button>
                        <Button variant="destructive" onClick={deleteOwn}>
                          <Trash2 className="h-4 w-4 mr-1" />Delete
                        </Button>
                      </>
                    )}
                    <p className="w-full text-[11px] text-muted-foreground">
                      {scope === "marketplace" 
                        ? "You own this order. You can edit or delete it from your Place Order page."
                        : "You own this order. Suppliers will negotiate, accept or decline it from their dashboard."}
                    </p>
                  </div>
                </>
              )
            ) : (
              /* ----- VISITOR (SUPPLIER) VIEW — read-only ----- */
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <I label="Buyer" v={selected.buyer_name || "Buyer"} />
                  <I label="Quantity" v={`${Number(selected.quantity_needed).toLocaleString()} ${selected.unit}`} />
                  <I label="Target price" v={formatMarketPrice(selected.target_price, selected.unit, selected.price_label)} />
                  <I label="Region" v={selected.region || "N/A"} />
                  <I label="Quality" v={selected.quality || "N/A"} />
                  <I label="Grade" v={selected.grade || "N/A"} />
                  <I label="Moisture" v={selected.moisture || "N/A"} />
                  <I label="Delivery" v={`${selected.delivery_start || "?"} → ${selected.delivery_end || "?"}`} />
                </div>
                {selected.notes && <p className="text-sm text-muted-foreground border-t pt-2">{selected.notes}</p>}
                <div className="flex gap-2 flex-wrap pt-2">
                  <Button variant="outline" onClick={openNegotiate}><Handshake className="h-4 w-4 mr-1" />Negotiate</Button>
                  <Button onClick={acceptOrder} disabled={busy}><CheckCircle2 className="h-4 w-4 mr-1" />Accept</Button>
                  <Button variant="destructive" onClick={declineOrder} disabled={busy}><XCircle className="h-4 w-4 mr-1" />Decline</Button>
                </div>
              </>
            )}
          </>}
        </DialogContent>
      </Dialog>

      {/* Negotiation chat — only valid from the public supplier listing. */}
      <Dialog open={chatOpen && (scope === "marketplace" || scope === "global") && !!selected && !!user} onOpenChange={(o) => { if (!o) setChatOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle><MessageCircle className="h-4 w-4 inline mr-1" /> Negotiate {selected?.crop_name}</DialogTitle></DialogHeader>
          {selected && user && (
            <ChatPanel
              key={`${user.id}-${selected.buyer_id}-${selected.id}`}
              otherUserId={selected.buyer_id}
              otherName={`${selected.buyer_name || selected.crop_name} Buyer`}
              otherRole="buyer"
              relatedOrderId={selected.id}
              defaultUnit={selected.unit}
              defaultPrice={Number(selected.target_price || 0)}
              defaultQuantity={Number(selected.quantity_needed || 0)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ============================================================== */
/*  OwnOrderListing — kept as a thin wrapper for back-compat.       */
/*  Now simply renders OrderListing scoped to "mine".               */
/* ============================================================== */
export function OwnOrderListing() {
  const { user } = useAuth();
  if (!user) return <p className="text-sm text-muted-foreground py-4 text-center">Sign in to view your orders.</p>;
  return <OrderListing scope="mine" />;
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
