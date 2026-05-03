import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, Calendar, BadgeCheck, Phone, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "./ChatPanel";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";

export interface SupplyRow {
  id: string; user_id: string; crop_name: string; category: string | null;
  region: string | null; expected_quantity: number; unit: string;
  quality_grade: string | null; harvest_start: string | null; harvest_end: string | null;
  delivery_timeline: string | null; suggested_price: number | null;
  image_url: string | null; verified: boolean | null;
  contact_email: string | null; contact_phone: string | null;
  notes: string | null; status: string; created_at: string;
}

const CATEGORIES = ["All", "Cereal", "Tuber", "Vegetable", "Fruit", "Legume", "Cash Crop", "Other"];

export function SupplyList({ requireAuthForChat = true }: { requireAuthForChat?: boolean }) {
  const [items, setItems] = useState<SupplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<SupplyRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
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
    if (!user && requireAuthForChat) { navigate("/marketplace/auth"); return; }
    setChatOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search crop or notes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="price_asc">Price: low → high</SelectItem>
            <SelectItem value="price_desc">Price: high → low</SelectItem>
            <SelectItem value="qty_desc">Largest quantity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading listings…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No supply listings match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => setSelected(s)}>
              <div className="aspect-video bg-muted relative">
                {s.image_url ? <img src={s.image_url} alt={s.crop_name} className="w-full h-full object-cover" loading="lazy" />
                  : <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No image</div>}
                {s.verified && <Badge className="absolute top-2 right-2 bg-green-600 text-white"><BadgeCheck className="h-3 w-3 mr-1" />Verified</Badge>}
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{s.crop_name}</div>
                  {s.suggested_price ? <div className="text-sm font-semibold text-primary">{s.suggested_price}/{s.unit}</div> : null}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{Number(s.expected_quantity).toLocaleString()} {s.unit}</span>
                  {s.quality_grade && <Badge variant="outline" className="text-[10px]">Grade {s.quality_grade}</Badge>}
                  {s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.region || "Region n/a"}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Harvest {s.harvest_start || "?"}{s.harvest_end ? ` → ${s.harvest_end}` : ""}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{selected.crop_name} {selected.verified && <BadgeCheck className="h-4 w-4 text-green-600" />}</DialogTitle></DialogHeader>
              {selected.image_url && <img src={selected.image_url} alt={selected.crop_name} className="w-full max-h-64 object-cover rounded-lg" />}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Category" value={selected.category || "—"} />
                <Info label="Quantity" value={`${Number(selected.expected_quantity).toLocaleString()} ${selected.unit}`} />
                <Info label="Quality grade" value={selected.quality_grade || "—"} />
                <Info label="Suggested price" value={selected.suggested_price ? `${selected.suggested_price}/${selected.unit}` : "—"} />
                <Info label="Region" value={selected.region || "—"} />
                <Info label="Harvest window" value={`${selected.harvest_start || "?"} → ${selected.harvest_end || "?"}`} />
                <Info label="Delivery timeline" value={selected.delivery_timeline || "—"} />
                <Info label="Status" value={selected.status} />
              </div>
              {selected.notes && <p className="text-sm text-muted-foreground border-t pt-2">{selected.notes}</p>}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="font-semibold">Supplier contact</div>
                {selected.contact_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><a className="text-primary hover:underline" href={`mailto:${selected.contact_email}`}>{selected.contact_email}</a></div>}
                {selected.contact_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><a className="text-primary hover:underline" href={`tel:${selected.contact_phone}`}>{selected.contact_phone}</a></div>}
                {!selected.contact_email && !selected.contact_phone && <div className="text-muted-foreground text-xs">No public contact — use chat.</div>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={openChat}><MessageCircle className="h-4 w-4 mr-1" /> Contact Supplier</Button>
                <Button variant="outline" onClick={openChat}>Negotiate</Button>
                <Button variant="outline" onClick={openChat}>Pre-Order</Button>
              </div>
              {chatOpen && user && selected.user_id !== user.id && (
                <ChatPanel otherUserId={selected.user_id} otherName={`Supplier · ${selected.crop_name}`} relatedSupplyId={selected.id} />
              )}
              {chatOpen && user && selected.user_id === user.id && (
                <p className="text-xs text-muted-foreground">This is your own listing.</p>
              )}
              {!user && requireAuthForChat && (
                <p className="text-xs text-muted-foreground"><Link to="/marketplace/auth" className="text-primary hover:underline">Sign in</Link> to chat with supplier.</p>
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
