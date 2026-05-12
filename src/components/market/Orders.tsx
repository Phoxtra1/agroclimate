import { useEffect, useMemo, useState } from "react";
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
  Handshake, CheckCircle2, XCircle, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";
import { ChatPanel } from "./ChatPanel";
import {
  openNegotiation, acceptNegotiation, declineNegotiation,
} from "@/lib/negotiationEngine";

export interface OrderRow {
  id: string; buyer_id: string; buyer_name: string | null; crop_name: string;
  region: string | null; quantity_needed: number; unit: string;
  target_price: number; price_label?: string | null;
  delivery_start: string | null; delivery_end: string | null;
  status: string; order_status?: string | null; negotiation_status?: string | null;
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
      const { error } = await supabase.from("buyer_orders" as any).insert({
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
        negotiation_status: "pending",
      } as any);
      if (error) throw error;
      toast.success("Order posted to Market Link");
      setProduct(""); setQty(""); setPrice(""); setNotes("");
      onPlaced?.();
    } catch (err: any) { toast.error(err.message || "Failed to place order"); }
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
/*  Shared query hook used by supplier + buyer order listings.      */
/*  scope="own" => ONLY current buyer rows.                         */
/*  scope="all" => marketplace demand EXCLUDING current user's rows. */
/* ============================================================== */
function useOrders(scope: "all" | "own") {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("buyer_orders" as any)
      .select("*")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(200);

    if (scope === "own") {
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }
      query = query.eq("buyer_id", user.id);
    }

    if (scope === "all" && user) {
      query = query.neq("buyer_id", user.id);
    }
    const { data } = await query;
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`orders-${scope}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, scope]);

  return { items, loading, reload: load };
}

/* ============================================================== */
/*  OrderListing — SUPPLIER marketplace dashboard view              */
/*  Shows buyer demand only; excludes the signed-in buyer's rows.   */
/*  Allowed actions: Negotiate / Accept / Decline only.             */
/* ============================================================== */
export function OrderListing() {
  const { user } = useAuth();
  const { items, loading, reload } = useOrders("all");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

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
    } catch (e: any) { toast.error(e?.message || "Could not accept"); }
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
    } catch (e: any) { toast.error(e?.message || "Could not decline"); }
    finally { setBusy(false); }
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
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map((o) => (
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
                  <Badge variant="secondary" className="text-[10px]">Buyer demand</Badge>
                  {o.negotiation_status && <Badge variant="outline" className="text-[10px] capitalize">{o.negotiation_status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}</div>}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <>
            <DialogHeader><DialogTitle>{selected.crop_name} — buyer · {selected.buyer_name || "Buyer"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <I label="Buyer" v={selected.buyer_name || "Buyer"} />
                  <I label="Quantity" v={`${Number(selected.quantity_needed).toLocaleString()} ${selected.unit}`} />
                  <I label="Target price" v={formatMarketPrice(selected.target_price, selected.unit, selected.price_label)} />
                  <I label="Region" v={selected.region || "—"} />
                  <I label="Quality" v={selected.quality || "—"} />
                  <I label="Grade" v={selected.grade || "—"} />
                  <I label="Moisture" v={selected.moisture || "—"} />
                  <I label="Delivery" v={`${selected.delivery_start || "?"} → ${selected.delivery_end || "?"}`} />
                </div>
                {selected.notes && <p className="text-sm text-muted-foreground border-t pt-2">{selected.notes}</p>}

                {/* SUPPLIER-ONLY ACTIONS — no Edit / Save / Delete here. */}
                <div className="flex gap-2 flex-wrap pt-2">
                  <Button variant="outline" onClick={openNegotiate}><Handshake className="h-4 w-4 mr-1" />Negotiate</Button>
                  <Button onClick={acceptOrder} disabled={busy}><CheckCircle2 className="h-4 w-4 mr-1" />Accept</Button>
                  <Button variant="destructive" onClick={declineOrder} disabled={busy}><XCircle className="h-4 w-4 mr-1" />Decline</Button>
                  <p className="w-full text-[11px] text-muted-foreground">Decline keeps this order active for other suppliers.</p>
                </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={chatOpen && !!selected && !!user && selected?.buyer_id !== user?.id} onOpenChange={(o) => { if (!o) setChatOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle><MessageCircle className="h-4 w-4 inline mr-1" /> Negotiate — {selected?.crop_name}</DialogTitle></DialogHeader>
          {selected && user && selected.buyer_id !== user.id && (
            <ChatPanel
              otherUserId={selected.buyer_id}
              otherName={`Buyer · ${selected.buyer_name || selected.crop_name}`}
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
/*  OwnOrderListing — buyer's own orders, beside the Place Order   */
/*  form on the Marketplace homepage. Edit / Save / Delete only.   */
/* ============================================================== */
export function OwnOrderListing() {
  const { user } = useAuth();
  const { items, loading, reload } = useOrders("own");

  if (!user) return <p className="text-sm text-muted-foreground py-4 text-center">Sign in to view your orders.</p>;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Your orders</div>
      {loading ? <p className="text-xs text-muted-foreground">Loading…</p>
        : items.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p>
        : items.map((o) => (
          <OwnOrderCard key={o.id} order={o} onChanged={reload} />
        ))}
    </div>
  );
}

/* ============================================================== */
/*  OwnOrderCard — inline Edit / Delete / Save only.                */
/* ============================================================== */
function OwnOrderCard({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>(order);

  useEffect(() => { setDraft(order); }, [order]);

  const beginEdit = () => {
    setDraft({ ...order, price_label: order.price_label || String(order.target_price || "") });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user) return;
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
        notes: draft.notes || null,
      };
      const { error } = await supabase.from("buyer_orders" as any)
        .update(patch as any).eq("id", order.id).eq("buyer_id", user.id);
      if (error) throw error;
      toast.success("Order updated");
      setEditing(false);
      onChanged();
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteOrder = async () => {
    if (!user) return;
    if (!window.confirm("Delete this order?")) return;
    const { error } = await supabase.from("buyer_orders" as any)
      .delete().eq("id", order.id).eq("buyer_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order deleted");
    onChanged();
  };

  return (
    <Card>
      <CardContent className="p-2.5 space-y-2">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2"><Label className="text-[11px]">Product</Label><Input value={String(draft.crop_name || "")} onChange={(e) => setDraft((d) => ({ ...d, crop_name: e.target.value }))} /></div>
            <div><Label className="text-[11px]">Quantity</Label><Input type="number" value={String(draft.quantity_needed || "")} onChange={(e) => setDraft((d) => ({ ...d, quantity_needed: Number(e.target.value) }))} /></div>
            <div><Label className="text-[11px]">Unit</Label><Select value={String(draft.unit || "kg")} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2"><Label className="text-[11px]">Target price</Label><Input value={String(draft.price_label || "")} onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label className="text-[11px]">Notes</Label><Textarea rows={2} value={String(draft.notes || "")} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(order); }}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{order.crop_name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {Number(order.quantity_needed).toLocaleString()} {order.unit} · {formatMarketPrice(order.target_price, order.unit, order.price_label)}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={beginEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteOrder}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
