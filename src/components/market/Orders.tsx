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
/*  Shared list renderer used by OrderListing + OwnOrderListing.   */
/* ============================================================== */
function useOrders(scope: "all" | "own") {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("buyer_orders" as any).select("*").neq("status", "cancelled").order("created_at", { ascending: false }).limit(200);
    if (scope === "own") {
      if (!user) { setItems([]); setLoading(false); return; }
      query = (query as any).eq("buyer_id", user.id);
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
/*  OrderListing — Dashboard view, role-aware                      */
/*  Owner buyer rows: Edit/Save/Delete                             */
/*  Other (supplier) rows: Negotiate/Accept/Decline                */
/* ============================================================== */
export function OrderListing() {
  const { user } = useAuth();
  const { items, loading, reload } = useOrders("all");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

  const isOwner = (o: OrderRow) => !!user && o.buyer_id === user.id;

  /* --- supplier-side actions ------------------------------------ */
  const openNegotiate = () => {
    if (!selected || !user) { toast.error("Sign in to negotiate"); return; }
    if (isOwner(selected)) { toast.info("This is your own order — suppliers will respond to you."); return; }
    setChatOpen(true);
  };

  const acceptOrder = async () => {
    if (!selected || !user || isOwner(selected)) return;
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
    if (!selected || !user || isOwner(selected)) return;
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

  /* --- owner buyer actions -------------------------------------- */
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...selected, price_label: selected.price_label || String(selected.target_price || "") });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected || !user || !isOwner(selected)) return;
    setSaving(true);
    try {
      const label = String(draft.price_label || "").trim();
      const patch = {
        buyer_name: draft.buyer_name || null,
        crop_name: String(draft.crop_name || "").trim(),
        region: draft.region || null,
        quantity_needed: Number(draft.quantity_needed || 0),
        unit: draft.unit || "kg",
        target_price: parseMarketPrice(label),
        price_label: label || null,
        quality: draft.quality || null,
        grade: draft.grade || null,
        moisture: draft.moisture || null,
        contact_email: draft.contact_email || null,
        contact_phone: draft.contact_phone || null,
        notes: draft.notes || null,
      };
      const { error } = await supabase.from("buyer_orders" as any).update(patch as any).eq("id", selected.id).eq("buyer_id", user.id);
      if (error) throw error;
      toast.success("Order saved");
      setEditing(false);
      setSelected({ ...selected, ...patch } as OrderRow);
      reload();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteOrder = async () => {
    if (!selected || !user || !isOwner(selected)) return;
    if (!window.confirm("Delete this order?")) return;
    const { error } = await supabase.from("buyer_orders" as any).delete().eq("id", selected.id).eq("buyer_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order deleted");
    setSelected(null);
    reload();
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
            <Card key={o.id} className="hover:shadow-md transition cursor-pointer" onClick={() => { setSelected(o); setEditing(false); setChatOpen(false); }}>
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
                  {isOwner(o) ? <Badge className="text-[10px]">Your order</Badge> : <Badge variant="secondary" className="text-[10px]">Buyer demand</Badge>}
                  {o.negotiation_status && <Badge variant="outline" className="text-[10px] capitalize">{o.negotiation_status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}</div>}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setEditing(false); setChatOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <>
            <DialogHeader><DialogTitle>{selected.crop_name} — {isOwner(selected) ? "your order" : `buyer · ${selected.buyer_name || "Buyer"}`}</DialogTitle></DialogHeader>

            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Buyer name</Label><Input value={String(draft.buyer_name || "")} onChange={(e) => setDraft((d) => ({ ...d, buyer_name: e.target.value }))} /></div>
                <div><Label>Product</Label><Input value={String(draft.crop_name || "")} onChange={(e) => setDraft((d) => ({ ...d, crop_name: e.target.value }))} /></div>
                <div><Label>Quantity</Label><Input type="number" value={String(draft.quantity_needed || "")} onChange={(e) => setDraft((d) => ({ ...d, quantity_needed: Number(e.target.value) }))} /></div>
                <div><Label>Unit</Label><Select value={String(draft.unit || "kg")} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Target price</Label><Input value={String(draft.price_label || "")} onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} /></div>
                <div><Label>Region</Label><Input value={String(draft.region || "")} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={String(draft.contact_email || "")} onChange={(e) => setDraft((d) => ({ ...d, contact_email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={String(draft.contact_phone || "")} onChange={(e) => setDraft((d) => ({ ...d, contact_phone: e.target.value }))} /></div>
                <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={String(draft.notes || "")} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
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

                {/* Role-aware actions */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {isOwner(selected) ? (
                    <>
                      <Button onClick={beginEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                      <Button variant="outline" onClick={beginEdit}><Save className="h-4 w-4 mr-1" />Save changes</Button>
                      <Button variant="destructive" onClick={deleteOrder}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <p className="w-full text-[11px] text-muted-foreground">Suppliers can negotiate, accept or decline from their dashboard.</p>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={openNegotiate}><Handshake className="h-4 w-4 mr-1" />Negotiate</Button>
                      <Button onClick={acceptOrder} disabled={busy}><CheckCircle2 className="h-4 w-4 mr-1" />Accept</Button>
                      <Button variant="destructive" onClick={declineOrder} disabled={busy}><XCircle className="h-4 w-4 mr-1" />Decline</Button>
                      <p className="w-full text-[11px] text-muted-foreground">Decline keeps this order active for other suppliers.</p>
                    </>
                  )}
                </div>
              </>
            )}
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
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>({});
  const [saving, setSaving] = useState(false);

  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...selected, price_label: selected.price_label || String(selected.target_price || "") });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected || !user) return;
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
      const { error } = await supabase.from("buyer_orders" as any).update(patch as any).eq("id", selected.id).eq("buyer_id", user.id);
      if (error) throw error;
      toast.success("Order updated");
      setEditing(false);
      setSelected({ ...selected, ...patch } as OrderRow);
      reload();
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteOrder = async () => {
    if (!selected || !user) return;
    if (!window.confirm("Delete this order?")) return;
    const { error } = await supabase.from("buyer_orders" as any).delete().eq("id", selected.id).eq("buyer_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order deleted");
    setSelected(null);
    reload();
  };

  if (!user) return <p className="text-sm text-muted-foreground py-4 text-center">Sign in to view your orders.</p>;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Your orders</div>
      {loading ? <p className="text-xs text-muted-foreground">Loading…</p>
        : items.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p>
        : items.map((o) => (
          <Card key={o.id} className="cursor-pointer" onClick={() => { setSelected(o); setEditing(false); }}>
            <CardContent className="p-2.5 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{o.crop_name}</div>
                <div className="text-[11px] text-muted-foreground">{Number(o.quantity_needed).toLocaleString()} {o.unit} · {formatMarketPrice(o.target_price, o.unit, o.price_label)}</div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">{o.negotiation_status || o.status}</Badge>
            </CardContent>
          </Card>
        ))}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setEditing(false); } }}>
        <DialogContent className="max-w-lg">
          {selected && <>
            <DialogHeader><DialogTitle>{selected.crop_name}</DialogTitle></DialogHeader>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Product</Label><Input value={String(draft.crop_name || "")} onChange={(e) => setDraft((d) => ({ ...d, crop_name: e.target.value }))} /></div>
                <div><Label>Quantity</Label><Input type="number" value={String(draft.quantity_needed || "")} onChange={(e) => setDraft((d) => ({ ...d, quantity_needed: Number(e.target.value) }))} /></div>
                <div><Label>Unit</Label><Select value={String(draft.unit || "kg")} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Target price</Label><Input value={String(draft.price_label || "")} onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} /></div>
                <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={String(draft.notes || "")} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm">{Number(selected.quantity_needed).toLocaleString()} {selected.unit} @ {formatMarketPrice(selected.target_price, selected.unit, selected.price_label)}</div>
                <div className="flex gap-2">
                  <Button onClick={beginEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                  <Button variant="destructive" onClick={deleteOrder}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                </div>
              </div>
            )}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
