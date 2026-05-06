import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, Calendar, MessageCircle, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ChatPanel } from "@/components/market/ChatPanel";
import { formatMarketPrice } from "@/lib/market";
import type { OrderRow } from "@/components/market/Orders";

type ChatMode = "contact" | "negotiate";

export function SupplierOrderListing({ requireAuthForChat = true }: { requireAuthForChat?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("contact");

  const isOwner = !!(selected && user && selected.buyer_id === user.id);

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

  useEffect(() => {
    load();
    const ch = supabase
      .channel("supplier-orders-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => items.filter((o) => {
    if (q && !`${o.crop_name} ${o.notes || ""} ${o.region || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (region && !(o.region || "").toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }), [items, q, region]);

  const openChat = (mode: ChatMode) => {
    if (!user) { toast.error("Sign in to start a live chat"); return; }
    if (isOwner) { toast.info("This is your own order — open it from your buyer dashboard."); return; }
    setChatMode(mode);
    setChatOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search buyer demand" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input placeholder="Region filter" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        : filtered.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No active buyer demand.</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map((o) => (
            <Card key={o.id} className="hover:shadow-md transition cursor-pointer" onClick={() => { setSelected(o); setChatOpen(false); }}>
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

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setChatOpen(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <DialogTitle>{selected.crop_name} — buyer demand</DialogTitle>
            </DialogHeader>

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

            {/* SUPPLIER-ONLY ACTIONS. Owner branch is hidden — no edit/delete here. */}
            {isOwner ? (
              <p className="text-[11px] text-muted-foreground border-t pt-2">
                This is your own order. Manage it (Edit · Save · Delete) from your buyer dashboard.
              </p>
            ) : (
              <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as ChatMode)} className="border-t pt-3">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="contact"><MessageCircle className="h-4 w-4 mr-1" />Contact Buyer</TabsTrigger>
                  <TabsTrigger value="negotiate"><Handshake className="h-4 w-4 mr-1" />Negotiate</TabsTrigger>
                </TabsList>
                <TabsContent value="contact" className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Open a live chat to introduce yourself and confirm interest.</p>
                  <Button onClick={() => openChat("contact")} className="w-full">
                    <MessageCircle className="h-4 w-4 mr-1" />Open Live Chat
                  </Button>
                </TabsContent>
                <TabsContent value="negotiate" className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Discuss price, quantity, grade or delivery terms in real time.</p>
                  <Button onClick={() => openChat("negotiate")} variant="outline" className="w-full">
                    <Handshake className="h-4 w-4 mr-1" />Start Negotiation Chat
                  </Button>
                </TabsContent>
                {!user && requireAuthForChat && (
                  <p className="w-full text-xs text-muted-foreground pt-2">
                    Sign in to chat live or negotiate.
                  </p>
                )}
              </Tabs>
            )}
          </>}
        </DialogContent>
      </Dialog>

      {/* Live Chat dialog — only for non-owner suppliers. */}
      <Dialog open={chatOpen && !!selected && !!user && !isOwner} onOpenChange={(o) => { if (!o) setChatOpen(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {chatMode === "negotiate" ? <Handshake className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              {chatMode === "negotiate" ? "Negotiate" : "Contact Buyer"} — {selected?.crop_name}
            </DialogTitle>
          </DialogHeader>
          {selected && user && !isOwner && (
            <ChatPanel
              otherUserId={selected.buyer_id}
              otherName={`Buyer · ${selected.buyer_name || selected.crop_name}`}
              relatedOrderId={selected.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function I({ label, v }: { label: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground uppercase">{label}</div><div className="font-medium">{v}</div></div>;
}
