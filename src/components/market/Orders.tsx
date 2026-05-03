import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, MessageCircle, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChatPanel } from "./ChatPanel";
import { Link, useNavigate } from "react-router-dom";

const CROPS = ["Maize", "Rice", "Cassava", "Yam", "Tomato", "Pepper", "Onion", "Cocoa", "Plantain", "Beans", "Groundnut"];
const UNITS = ["kg", "bags", "tons", "crates"];

export interface OrderRow {
  id: string; buyer_id: string; buyer_name: string | null; crop_name: string;
  region: string | null; quantity_needed: number; unit: string; target_price: number;
  delivery_start: string | null; delivery_end: string | null; status: string;
  quality: string | null; grade: string | null; moisture: string | null;
  contact_email: string | null; contact_phone: string | null;
  notes: string | null; created_at: string;
}

export function PlaceOrderForm({ onPlaced }: { onPlaced?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [crop, setCrop] = useState("Maize");
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
    if (!user) { navigate("/marketplace/auth"); return; }
    if (!qty || !price) { toast.error("Quantity and target price required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("buyer_orders" as any).insert({
        buyer_id: user.id, buyer_name: name || user.email || null,
        crop_name: crop, region: region || null,
        quantity_needed: Number(qty), unit, target_price: Number(price),
        delivery_start: start || null, delivery_end: end || null,
        quality: quality || null, grade: grade || null, moisture: moisture || null,
        contact_email: email || user.email || null, contact_phone: phone || null,
        notes: notes || null,
      } as any);
      if (error) throw error;
      toast.success("Order posted to marketplace");
      setQty(""); setPrice(""); setNotes("");
      onPlaced?.();
    } catch (err: any) { toast.error(err.message || "Failed to place order"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><Label>Buyer / company name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your business" /></div>
      <div><Label>Product needed</Label>
        <Select value={crop} onValueChange={setCrop}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Quantity</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Quality (e.g. fresh, dried)</Label><Input value={quality} onChange={(e) => setQuality(e.target.value)} /></div>
      <div><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A / B / C" /></div>
      <div><Label>Moisture %</Label><Input value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="e.g. ≤ 14%" /></div>
      <div><Label>Target price / {unit}</Label><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      <div><Label>Delivery region / location</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Delivery from</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Delivery to</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Additional notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Order"}
        </Button>
      </div>
    </form>
  );
}

export function OrderListing({ requireAuthForChat = true }: { requireAuthForChat?: boolean }) {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("buyer_orders" as any)
        .select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(200);
      setItems((data as any) || []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel("orders-public-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

  const openChat = () => {
    if (!user && requireAuthForChat) { navigate("/marketplace/auth"); return; }
    setChatOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search crop or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No active buyer demand.</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((o) => (
              <Card key={o.id} className="hover:shadow-md transition cursor-pointer" onClick={() => setSelected(o)}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{o.crop_name}</div>
                    <div className="text-sm font-semibold text-primary">{o.target_price}/{o.unit}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{o.buyer_name || "Buyer"} needs {Number(o.quantity_needed).toLocaleString()} {o.unit}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{o.region || "Anywhere"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Deliver {o.delivery_start || "?"} → {o.delivery_end || "?"}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {o.grade && <Badge variant="outline" className="text-[10px]">Grade {o.grade}</Badge>}
                    {o.quality && <Badge variant="outline" className="text-[10px]">{o.quality}</Badge>}
                    {o.moisture && <Badge variant="outline" className="text-[10px]">{o.moisture}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.crop_name} — buyer demand</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <I label="Buyer" v={selected.buyer_name || "Buyer"} />
                <I label="Quantity" v={`${Number(selected.quantity_needed).toLocaleString()} ${selected.unit}`} />
                <I label="Target price" v={`${selected.target_price}/${selected.unit}`} />
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
              <div className="flex gap-2 flex-wrap">
                <Button onClick={openChat}><MessageCircle className="h-4 w-4 mr-1" /> Contact buyer</Button>
                <Button variant="outline" onClick={openChat}>Negotiate</Button>
              </div>
              {chatOpen && user && selected.buyer_id !== user.id && (
                <ChatPanel otherUserId={selected.buyer_id} otherName={`Buyer · ${selected.buyer_name || selected.crop_name}`} relatedOrderId={selected.id} />
              )}
              {chatOpen && user && selected.buyer_id === user.id && (
                <p className="text-xs text-muted-foreground">This is your own order.</p>
              )}
              {!user && requireAuthForChat && (
                <p className="text-xs text-muted-foreground"><Link to="/marketplace/auth" className="text-primary hover:underline">Sign in</Link> to contact this buyer.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
