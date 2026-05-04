import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, Calendar, BadgeCheck, Phone, Mail, MessageCircle, Pencil, Trash2, Save, Loader2, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "./ChatPanel";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";

export interface SupplyRow {
  id: string; user_id: string; crop_name: string; category: string | null;
  region: string | null; expected_quantity: number; unit: string;
  quality_grade: string | null; harvest_start: string | null; harvest_end: string | null;
  delivery_timeline: string | null; suggested_price: number | null; price_label?: string | null;
  image_url: string | null; verified: boolean | null;
  contact_email: string | null; contact_phone: string | null;
  notes: string | null; status: string; created_at: string;
}

const CATEGORIES = ["All", "Cereal", "Tuber", "Vegetable", "Fruit", "Legume", "Livestock", "Fish", "Mineral", "Raw Material", "Refined Material", "Other"];

export function SupplyList({ requireAuthForChat = true, allowOwnerActions = false, compact = false }: { requireAuthForChat?: boolean; allowOwnerActions?: boolean; compact?: boolean }) {
  const [items, setItems] = useState<SupplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<SupplyRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<SupplyRow>>({});
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("farmer_inputs" as any)
      .select("*")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("supply-public-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "farmer_inputs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let res = items.filter((s) => {
      if (cat !== "All" && (s.category || "Other") !== cat) return false;
      if (region && !(s.region || "").toLowerCase().includes(region.toLowerCase())) return false;
      if (q && !`${s.crop_name} ${s.notes || ""} ${s.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    if (sort === "price_asc") res = [...res].sort((a, b) => (a.suggested_price || 0) - (b.suggested_price || 0));
    else if (sort === "price_desc") res = [...res].sort((a, b) => (b.suggested_price || 0) - (a.suggested_price || 0));
    else if (sort === "qty_desc") res = [...res].sort((a, b) => Number(b.expected_quantity) - Number(a.expected_quantity));
    return res;
  }, [items, q, cat, region, sort]);

  const openChat = () => {
    if (!user && requireAuthForChat) { toast.info("Subscribe interest saved. Sign in later to continue live chat."); return; }
    setChatOpen(true);
  };

  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...selected, price_label: selected.price_label || String(selected.suggested_price || "") });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected || selected.user_id !== user?.id) return;
    setSaving(true);
    try {
      const priceLabel = String(draft.price_label || "").trim();
      const patch = {
        crop_name: String(draft.crop_name || "").trim(),
        category: draft.category || null,
        region: draft.region || null,
        expected_quantity: Number(draft.expected_quantity || 0),
        unit: draft.unit || "kg",
        quality_grade: draft.quality_grade || null,
        delivery_timeline: draft.delivery_timeline || null,
        suggested_price: parseMarketPrice(priceLabel),
        price_label: priceLabel || null,
        notes: draft.notes || null,
        contact_email: draft.contact_email || null,
        contact_phone: draft.contact_phone || null,
      };
      const { error } = await supabase.from("farmer_inputs" as any).update(patch as any).eq("id", selected.id).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Supply listing saved");
      setEditing(false);
      setSelected({ ...selected, ...patch } as SupplyRow);
      load();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteListing = async () => {
    if (!selected || selected.user_id !== user?.id) return;
    if (!window.confirm("Delete this supply listing?")) return;
    const { error } = await supabase.from("farmer_inputs" as any).delete().eq("id", selected.id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supply listing deleted");
    setSelected(null);
    load();
  };

  const preOrder = async () => {
    if (!selected) return;
    if (!user) { toast.info("Subscription interest noted. Sign in later to create a live pre-order."); return; }
    if (selected.user_id === user.id) { toast.info("This is your own listing."); return; }
    const qty = Math.max(1, Number(selected.expected_quantity || 1));
    const { error } = await supabase.from("market_contracts" as any).insert({
      farmer_id: selected.user_id,
      buyer_id: user.id,
      farmer_input_id: selected.id,
      crop_name: selected.crop_name,
      quantity: qty,
      unit: selected.unit,
      locked_price: Number(selected.suggested_price || 0),
      delivery_start: selected.harvest_start,
      delivery_end: selected.harvest_end,
      state: "proposed",
      logistics_status: "pending",
      notes: `Pre-order request for ${selected.crop_name}`,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Pre-order proposed. Continue in chat to negotiate terms.");
    setChatOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div className="md:col-span-2 relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search product or notes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={cat} onValueChange={setCat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
        <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Most recent</SelectItem><SelectItem value="price_asc">Price: low → high</SelectItem><SelectItem value="price_desc">Price: high → low</SelectItem><SelectItem value="qty_desc">Largest quantity</SelectItem></SelectContent></Select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading listings…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No supply listings match your filters.</p>
        : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"} gap-3`}>
            {filtered.map((s) => (
              <Card key={s.id} className="overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => { setSelected(s); setEditing(false); setChatOpen(false); }}>
                <div className={compact ? "aspect-[4/3] bg-muted relative" : "aspect-video bg-muted relative"}>
                  {s.image_url ? <img src={s.image_url} alt={s.crop_name} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No image</div>}
                  {s.verified && <Badge className="absolute top-2 right-2"><BadgeCheck className="h-3 w-3 mr-1" />Verified</Badge>}
                </div>
                <CardContent className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm truncate">{s.crop_name}</div><div className="text-xs font-semibold text-primary whitespace-nowrap">{formatMarketPrice(s.suggested_price, s.unit, s.price_label)}</div></div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap"><span>{Number(s.expected_quantity).toLocaleString()} {s.unit}</span>{s.quality_grade && <Badge variant="outline" className="text-[10px]">Grade {s.quality_grade}</Badge>}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.region || "Region n/a"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{s.harvest_start || "Available"}{s.harvest_end ? ` → ${s.harvest_end}` : ""}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); setEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{selected.crop_name} {selected.verified && <BadgeCheck className="h-4 w-4 text-green-600" />}</DialogTitle></DialogHeader>
              {selected.image_url && <img src={selected.image_url} alt={selected.crop_name} className="w-full max-h-64 object-cover rounded-lg" />}

              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Product</Label><Input value={String(draft.crop_name || "")} onChange={(e) => setDraft((d) => ({ ...d, crop_name: e.target.value }))} /></div>
                  <div><Label>Category</Label><Select value={String(draft.category || "Other")} onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.filter(c => c !== "All").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Quantity</Label><Input type="number" value={String(draft.expected_quantity || "")} onChange={(e) => setDraft((d) => ({ ...d, expected_quantity: Number(e.target.value) }))} /></div>
                  <div><Label>Unit</Label><Select value={String(draft.unit || "kg")} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Price</Label><Input value={String(draft.price_label || "")} onChange={(e) => setDraft((d) => ({ ...d, price_label: e.target.value }))} /></div>
                  <div><Label>Region</Label><Input value={String(draft.region || "")} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input value={String(draft.contact_email || "")} onChange={(e) => setDraft((d) => ({ ...d, contact_email: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={String(draft.contact_phone || "")} onChange={(e) => setDraft((d) => ({ ...d, contact_phone: e.target.value }))} /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={String(draft.notes || "")} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
                  <div className="sm:col-span-2 flex gap-2"><Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm"><Info label="Category" value={selected.category || "—"} /><Info label="Quantity" value={`${Number(selected.expected_quantity).toLocaleString()} ${selected.unit}`} /><Info label="Quality grade" value={selected.quality_grade || "—"} /><Info label="Price" value={formatMarketPrice(selected.suggested_price, selected.unit, selected.price_label)} /><Info label="Region" value={selected.region || "—"} /><Info label="Availability" value={`${selected.harvest_start || "?"} → ${selected.harvest_end || "?"}`} /><Info label="Delivery timeline" value={selected.delivery_timeline || "—"} /><Info label="Status" value={selected.status} /></div>
                  {selected.notes && <p className="text-sm text-muted-foreground border-t pt-2">{selected.notes}</p>}
                  <div className="border-t pt-3 space-y-1 text-sm"><div className="font-semibold">Supplier contact</div>{selected.contact_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><a className="text-primary hover:underline" href={`mailto:${selected.contact_email}`}>{selected.contact_email}</a></div>}{selected.contact_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><a className="text-primary hover:underline" href={`tel:${selected.contact_phone}`}>{selected.contact_phone}</a></div>}{!selected.contact_email && !selected.contact_phone && <div className="text-muted-foreground text-xs">No public contact — use chat.</div>}</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={openChat}><MessageCircle className="h-4 w-4 mr-1" />Contact Supplier</Button>
                    <Button variant="outline" onClick={openChat}><Handshake className="h-4 w-4 mr-1" />Negotiate</Button>
                    <Button variant="outline" onClick={preOrder}><Send className="h-4 w-4 mr-1" />Pre-Order</Button>
                    {allowOwnerActions && selected.user_id === user?.id && <Button variant="outline" onClick={beginEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>}
                    {allowOwnerActions && selected.user_id === user?.id && <Button variant="ghost" onClick={deleteListing}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}
                  </div>
                  {chatOpen && user && selected.user_id !== user.id && <ChatPanel otherUserId={selected.user_id} otherName={`Supplier · ${selected.crop_name}`} relatedSupplyId={selected.id} />}
                  {chatOpen && user && selected.user_id === user.id && <p className="text-xs text-muted-foreground">This is your own listing.</p>}
                  {!user && requireAuthForChat && <p className="text-xs text-muted-foreground">Subscription interest can be recorded now; live chat unlocks after sign in.</p>}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div><div className="font-medium">{value}</div></div>;
}
