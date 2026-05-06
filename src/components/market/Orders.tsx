import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, MessageCircle, MapPin, Calendar, Pencil, Trash2, Save, Send, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChatPanel } from "./ChatPanel";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";

export interface OrderRow {
  id: string; buyer_id: string; buyer_name: string | null; crop_name: string;
  region: string | null; quantity_needed: number; unit: string; target_price: number; price_label?: string | null;
  delivery_start: string | null; delivery_end: string | null; status: string;
  quality: string | null; grade: string | null; moisture: string | null;
  contact_email: string | null; contact_phone: string | null;
  notes: string | null; created_at: string;
}

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

/**
 * OrderListing
 * ------------
 * Buyer demand board. Action-button visibility is strictly role-aware:
 *
 *   OWNER  (selected.buyer_id === user.id)
 *     • Edit, Save, Delete  → ALWAYS available when allowOwnerActions=true.
 *     • NO Chat / Negotiate / Pre-Order — buyers do not chat with themselves
 *       and cannot negotiate against their own demand. Suppliers initiate.
 *
 *   SUPPLIER (any other authenticated user)
 *     • Chat with buyer, Negotiate, Pre-Order  → always shown.
 *     • Cannot edit, save, or delete the buyer's order.
 */
export function OrderListing({ requireAuthForChat = true, allowOwnerActions = false }: { requireAuthForChat?: boolean; allowOwnerActions?: boolean }) {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>({});
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const isOwner = !!(selected && user && selected.buyer_id === user.id);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("buyer_orders" as any).select("*").neq("status", "cancelled").order("created_at", { ascending: false }).limit(200);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("orders-public-stream").on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

  const openChat = () => {
    if (!user) { toast.error("Please sign in to start a live chat"); return; }
    if (isOwner) { toast.info("Buyers cannot chat on their own order — suppliers will reach out."); return; }
    setChatOpen(true);
  };

  const beginEdit = () => {
    if (!selected || !isOwner) return;
    setDraft({ ...selected, price_label: selected.price_label || String(selected.target_price || "") });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected || !isOwner) return;
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
      const { error } = await supabase.from("buyer_orders" as any).update(patch as any).eq("id", selected.id).eq("buyer_id", user!.id);
      if (error) throw error;
      toast.success("Order listing saved");
      setEditing(false);
      setSelected({ ...selected, ...patch } as OrderRow);
      load();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteOrder = async () => {
    if (!selected || !isOwner) return;
    if (!window.confirm("Delete this buyer order?")) return;
    const { error } = await supabase.from("buyer_orders" as any).delete().eq("id", selected.id).eq("buyer_id", user!.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order listing deleted");
    setSelected(null);
    load();
  };

  // Pre-order is a SUPPLIER action — proposing to fulfil the buyer's demand.
  // Owners (buyers) can never pre-order against themselves.
  const preOrderResponse = async () => {
    if (!selected) return;
    if (!user) { toast.info("Sign in to send a supplier response."); return; }
    if (isOwner) { toast.info("Buyers cannot pre-order on their own demand."); return; }
    const { error } = await supabase.from("market_contracts" as any).insert({
      farmer_id: user.id,
      buyer_id: selected.buyer_id,
      buyer_order_id: selected.id,
      crop_name: selected.crop_name,
      quantity: Number(selected.quantity_needed || 1),
      unit: selected.unit,
      locked_price: Number(selected.target_price || 0),
      delivery_start: selected.delivery_start,
      delivery_end: selected.delivery_end,
      state: "proposed",
      logistics_status: "pending",
      notes: `Farmer response to buyer demand for ${selected.crop_name}`,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Response proposed. Continue in chat to negotiate terms.");
    setChatOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search product or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No active buyer demand.</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map((o) => (
            <Card key={o.id} className="hover:shadow-md transition cursor-pointer" onClick={() => { setSelected(o); setEditing(false); setChatOpen(false); }}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{o.crop_name}</div>
                  <div className="text-sm font-semibold text-primary whitespace-nowrap">{formatMarketPrice(o.target_price, o.unit, o.price_label)}</div>
                </div>
                <div className="text-xs text-muted-foreground">{o.buyer_name || "Buyer"} needs {Number(o.quantity_needed).toLocaleString()} {o.unit}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{o.region || "Anywhere"}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Deliver {o.delivery_start || "?"} → {o.delivery_end || "?"}</div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {o.grade && <Badge variant="outline" className="text-[10px]">Grade {o.grade}</Badge>}
                  {o.quality && <Badge variant="outline" className="text-[10px]">{o.quality}</Badge>}
                  {o.moisture && <Badge variant="outline" className="text-[10px]">{o.moisture}</Badge>}
                  {user && o.buyer_id === user.id && <Badge className="text-[10px]">Your order</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}</div>}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <DialogTitle>{selected.crop_name} — buyer demand</DialogTitle>
            </DialogHeader>

            {editing && isOwner && allowOwnerActions ? (
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
                <div className="border-t pt-2 space-y-1 text-xs">
                  {selected.contact_email && <div>📧 <a className="text-primary hover:underline" href={`mailto:${selected.contact_email}`}>{selected.contact_email}</a></div>}
                  {selected.contact_phone && <div>📞 <a className="text-primary hover:underline" href={`tel:${selected.contact_phone}`}>{selected.contact_phone}</a></div>}
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  {/* Owner branch — only edit/save/delete, never chat/negotiate/pre-order. */}
                  {isOwner && allowOwnerActions ? (
                    <>
                      <Button onClick={beginEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                      <Button variant="outline" onClick={beginEdit}><Save className="h-4 w-4 mr-1" />Save changes</Button>
                      <Button variant="destructive" onClick={deleteOrder}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <p className="w-full text-[11px] text-muted-foreground">
                        You posted this order. Suppliers will contact you to chat, negotiate or pre-order.
                      </p>
                    </>
                  ) : isOwner ? (
                    <p className="text-[11px] text-muted-foreground">
                      You posted this order. Edit and delete are available from your buyer dashboard.
                    </p>
                  ) : (
                    <>
                      {/* Supplier branch — chat / negotiate / pre-order only. */}
                      <Button onClick={openChat}><MessageCircle className="h-4 w-4 mr-1" />Contact buyer</Button>
                      <Button variant="outline" onClick={openChat}><Handshake className="h-4 w-4 mr-1" />Negotiate</Button>
                      <Button variant="outline" onClick={preOrderResponse}><Send className="h-4 w-4 mr-1" />Pre-Order</Button>
                      {!user && requireAuthForChat && (
                        <p className="w-full text-xs text-muted-foreground">
                          Sign in to chat live or negotiate. Subscription required to unlock direct messaging when paywall is active.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </>}
        </DialogContent>
      </Dialog>

      {/* Dedicated chat dialog — never opens for the order owner. */}
      <Dialog open={chatOpen && !!selected && !!user && !isOwner} onOpenChange={(o) => { if (!o) setChatOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Chat — {selected?.crop_name}</DialogTitle>
          </DialogHeader>
          {selected && user && !isOwner && (
            <ChatPanel otherUserId={selected.buyer_id} otherName={`Buyer · ${selected.buyer_name || selected.crop_name}`} relatedOrderId={selected.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
