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
  Handshake, CheckCircle2, XCircle, MessageCircle
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";
import { ChatPanel } from "./ChatPanel";
import {
  openNegotiation,
  acceptNegotiation,
  declineNegotiation,
} from "@/lib/negotiationEngine";

/* =========================================================
   ORDER TYPE
========================================================= */
export interface OrderRow {
  id: string;
  buyer_id: string;
  buyer_name: string | null;
  crop_name: string;
  region: string | null;
  quantity_needed: number;
  unit: string;
  target_price: number;
  price_label?: string | null;
  delivery_start: string | null;
  delivery_end: string | null;
  status: string;
  order_status?: string | null;
  quality: string | null;
  grade: string | null;
  moisture: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

/* =========================================================
   PLACE ORDER (BUYER DEMAND)
========================================================= */
export function PlaceOrderForm({ onPlaced }: { onPlaced?: () => void }) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    product: "",
    region: "",
    qty: "",
    unit: "kg",
    price: "",
    quality: "",
    grade: "",
    moisture: "",
    email: "",
    phone: "",
    notes: "",
    start: "",
    end: "",
  });

  const [busy, setBusy] = useState(false);

  const update = (k: string, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Authentication required");

    setBusy(true);

    try {
      const { error } = await supabase.from("buyer_orders").insert({
        buyer_id: user.id,
        buyer_name: user.email,
        crop_name: form.product,
        region: form.region || null,
        quantity_needed: Number(form.qty),
        unit: form.unit,
        target_price: parseMarketPrice(form.price),
        price_label: form.price,
        delivery_start: form.start || null,
        delivery_end: form.end || null,
        quality: form.quality || null,
        grade: form.grade || null,
        moisture: form.moisture || null,
        contact_email: form.email || user.email,
        contact_phone: form.phone || null,
        notes: form.notes || null,
        order_status: "active",
      });

      if (error) throw error;

      toast.success("Order submitted to Market Link");
      onPlaced?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input placeholder="Product" value={form.product} onChange={(e) => update("product", e.target.value)} />
      <Input placeholder="Region" value={form.region} onChange={(e) => update("region", e.target.value)} />
      <Input type="number" placeholder="Quantity" value={form.qty} onChange={(e) => update("qty", e.target.value)} />

      <Select value={form.unit} onValueChange={(v) => update("unit", v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input placeholder="Target price" value={form.price} onChange={(e) => update("price", e.target.value)} />

      <Button disabled={busy} type="submit" className="sm:col-span-2">
        {busy ? <Loader2 className="animate-spin" /> : "Submit Order"}
      </Button>
    </form>
  );
}

/* =========================================================
  DASHBOARD-MARKET-LINK-ORDER LISTINGS SCOPE
========================================================= */
type Scope = "dashboard-marketplace-link-supply" | "mine";

/* =========================================================
   DATA HOOK
========================================================= */
function useOrders(scope: Scope) {
  const { user } = useAuth();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    let q = supabase
      .from("buyer_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (scope === "mine") {
      q = q.eq("buyer_id", user?.id);
    }

    if (scope === "dashboard-marketplace-link-supply") {
      q = q.neq("buyer_id", user?.id);
    }

    const { data } = await q.limit(200);

    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("market-link-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scope, user?.id]);

  return { items, loading, reload: load };
}

/* =========================================================
   ORDER LISTING (CORE SUPPLIER + OWNER ENGINE)
========================================================= */
export function OrderListing({ scope = "dashboard-marketplace-link-supply" as Scope }) {
  const { user } = useAuth();
  const { items, loading, reload } = useOrders(scope);

  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<OrderRow>>({});

  const isOwner = selected?.buyer_id === user?.id;
  const isSupplierView = scope === "dashboard-marketplace-link-supply";

  const filtered = useMemo(() => items, [items]);

  /* ---------------- Supplier actions ---------------- */
  const accept = async () => {
    if (!selected || !user) return;

    setBusy(true);
    try {
      const n = await openNegotiation({
        buyerId: selected.buyer_id,
        supplierId: user.id,
        orderId: selected.id,
      });

      await acceptNegotiation(n, {
        agreedPrice: selected.target_price,
        agreedQuantity: selected.quantity_needed,
        unit: selected.unit,
      });

      toast.success("Accepted");
      reload();
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!selected || !user) return;

    const n = await openNegotiation({
      buyerId: selected.buyer_id,
      supplierId: user.id,
      orderId: selected.id,
    });

    await declineNegotiation(n);
    toast.info("Declined");
    setSelected(null);
  };

  /* ---------------- Owner update ---------------- */
  const save = async () => {
    if (!selected || !user) return;

    const { error } = await supabase
      .from("buyer_orders")
      .update({
        crop_name: draft.crop_name,
        region: draft.region,
        notes: draft.notes,
      })
      .eq("id", selected.id)
      .eq("buyer_id", user.id);

    if (error) return toast.error(error.message);

    toast.success("Updated");
    setEditing(false);
    reload();
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <Card key={o.id} onClick={() => setSelected(o)}>
              <CardContent className="p-3">
                <div className="font-semibold">{o.crop_name}</div>
                <div>{formatMarketPrice(o.target_price, o.unit, o.price_label)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isOwner ? "Your Order" : "Supplier View"}
                </DialogTitle>
              </DialogHeader>

              {isOwner ? (
                <div className="space-y-2">
                  <Input
                    value={draft.crop_name || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, crop_name: e.target.value })
                    }
                  />
                  <Button onClick={save}><Save /> Save</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={accept}><CheckCircle2 /> Accept</Button>
                  <Button onClick={decline}><XCircle /> Decline</Button>
                  <Button onClick={() => setChatOpen(true)}>
                    <MessageCircle /> Negotiate
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* CHAT */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent>
          {selected && user && (
            <ChatPanel
              otherUserId={selected.buyer_id}
              otherName="Buyer"
              otherRole="buyer"
              relatedOrderId={selected.id}
              defaultPrice={selected.target_price}
              defaultQuantity={selected.quantity_needed}
              defaultUnit={selected.unit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================
   OWN ORDERS WRAPPER
========================================================= */
export function OwnOrderListing() {
  return <OrderListing scope="mine" />;
}
