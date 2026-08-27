/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Store, TrendingUp, TrendingDown, Minus, AlertTriangle, Truck, Handshake, Package,
  Loader2, Image as ImageIcon, Inbox
} from "lucide-react";
import { toast } from "sonner";
import { useMarketLink, suggestPrice, type PriceRow } from "@/hooks/useMarketLink";
import { makeThreadKey } from "@/hooks/useMarketChat";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SupplyList } from "@/components/market/SupplyList";
import { ChatPanel } from "@/components/market/ChatPanel";
import { OrderListing } from "@/components/market/Orders";
import { CopyButton } from "@/components/CopyButton";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";
import { estimateMarketPrice } from "@/lib/pricingEngine";
import { AGTransSupplierPanel } from "@/components/market/AGTransSupplierPanel";
import { PotentialBuyersPanel } from "@/components/market/PotentialBuyersPanel";
import { LogisticsMatcherPanel } from "@/components/market/LogisticsMatcherPanel";

const CATEGORIES = ["Cash Crop", "Cereal", "Tuber", "Vegetable", "Fruit", "Legume", "Livestock", "Fish", "Mineral", "Raw Material", "Refined Material", "Other"];

function trendIcon(t: string) {
  if (t === "rising") return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (t === "falling") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function OverviewCards({ totalSupply, totalDemand, activeContracts, balance }: { totalSupply: number; totalDemand: number; activeContracts: number; balance: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" /> Expected supply</div><p className="text-2xl font-bold mt-1">{totalSupply.toLocaleString()}</p></CardContent></Card>
      <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-4 w-4" /> Active demand</div><p className="text-2xl font-bold mt-1">{totalDemand.toLocaleString()}</p></CardContent></Card>
      <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4" /> Contracts</div><p className="text-2xl font-bold mt-1">{activeContracts}</p></CardContent></Card>
      <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Balance</div><p className={`text-base font-bold mt-1 capitalize ${balance === "shortage" ? "text-red-500" : balance === "surplus" ? "text-yellow-600" : "text-green-600"}`}>{balance}</p></CardContent></Card>
    </div>
  );
}

/* ============================================================== */
/*  SupplyForm — supplier publishes a new listing.                 */
/*  Auto-runs pricingEngine on submit so the estimated price is    */
/*  saved alongside the listing.                                   */
/* ============================================================== */
function SupplyForm({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("Other");
  const [region, setRegion] = useState(profile?.region || "");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [grade, setGrade] = useState("A");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [delivery, setDelivery] = useState("");
  const [price, setPrice] = useState("");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in first"); return; }
    if (!product.trim() || !qty) { toast.error("Product and quantity required"); return; }
    setBusy(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("supply-images").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("supply-images").getPublicUrl(path).data.publicUrl;
      }

      // --- pull market context for the pricing engine ---
      const [{ data: supplyCtx }, { data: demandCtx }] = await Promise.all([
        supabase.from("farmer_inputs" as any).select("crop_name,region,category,suggested_price,unit,status").neq("status", "cancelled").limit(500),
        supabase.from("buyer_orders" as any).select("crop_name,region,target_price,unit,status").neq("status", "cancelled").limit(500),
      ]);
      const est = estimateMarketPrice({
        cropName: product.trim(),
        region: region || null,
        category,
        quantity: Number(qty),
        unit,
        existingSupply: (supplyCtx as any) || [],
        activeBuyerRequests: (demandCtx as any) || [],
        currency: "GHS",
      });
      // Prefer supplier's own price if entered, otherwise use the estimate.
      const finalPrice = price.trim() ? parseMarketPrice(price) : est.estimatedPrice;
      const finalLabel = price.trim() || est.priceLabel;

      // Base payload only includes columns guaranteed to exist on farmer_inputs.
      const basePayload: Record<string, any> = {
        user_id: user.id,
        crop_name: product.trim(),
        category,
        region: region || null,
        expected_quantity: Number(qty),
        unit,
        quality_grade: grade,
        harvest_start: start || null,
        harvest_end: end || null,
        delivery_timeline: delivery || null,
        suggested_price: finalPrice,
        price_label: finalLabel,
        image_url,
        contact_email: email || user.email || null,
        contact_phone: phone || null,
        notes: notes || null,
      };
      // Optional columns added by the workflow-correction migration. If the
      // migration has not been applied to the connected Supabase project yet,
      // we strip the unknown columns and retry so publishing still works.
      const optionalPayload: Record<string, any> = {
        estimated_price: est.estimatedPrice,
        demand_level: est.demandLevel,
        listing_status: "active",
        risk_level: risk,
        owner_id: user.id,
      };
      const payload: Record<string, any> = { ...basePayload, ...optionalPayload };
      let { error } = await supabase.from("farmer_inputs" as any).insert(payload as any);
      // PostgREST returns PGRST204 ("Could not find the 'X' column ... in the schema cache")
      // when an optional column is missing. Strip unknown columns and retry once.
      while (error && (error as any).code === "PGRST204") {
        const m = /'([^']+)' column/.exec(error.message || "");
        const missing = m?.[1];
        if (!missing || !(missing in payload)) break;
        delete payload[missing];
        ({ error } = await supabase.from("farmer_inputs" as any).insert(payload as any));
      }
      if (error) throw error;
      toast.success(`Published — estimated ${est.priceLabel} · demand ${est.demandLevel}`);
      setProduct(""); setQty(""); setStart(""); setEnd(""); setNotes(""); setFile(null); setPrice("");
      onAdded();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><Label>Product</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Crop, livestock, fish, mineral, raw/refined material" required /></div>
      <div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Quantity</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Quality grade</Label><Select value={grade} onValueChange={setGrade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A">A — Premium</SelectItem><SelectItem value="B">B — Standard</SelectItem><SelectItem value="C">C — Economy</SelectItem></SelectContent></Select></div>
      <div><Label>Price / {unit} <span className="text-[10px] text-muted-foreground">(leave blank to auto-estimate)</span></Label><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="GHS 250, USD 40, ₦15000" /></div>
      <div><Label>Region / location</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Delivery timeline</Label><Input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="e.g. within 14 days" /></div>
      <div><Label>Availability start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Availability end</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div><Label>Climate/handling risk</Label><Select value={risk} onValueChange={(v) => setRisk(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
      <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user?.email || ""} /></div>
      <div><Label>Contact phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Description / notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="sm:col-span-2"><Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Product image</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="w-full h-11">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish supply listing"}</Button></div>
    </form>
  );
}

interface ThreadSummary { key: string; other: string; supplyId: string | null; orderId: string | null; lastBody: string; unread: number; lastAt: string; }

function useDisplayNames(userIds: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = userIds.slice().sort().join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles" as any)
        .select("id, full_name, company_name, email")
        .in("id", userIds);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (data as any[] | null)?.forEach((p) => {
        map[p.id] = (p.full_name?.trim() || p.company_name?.trim() || p.email?.split("@")[0] || `User · ${String(p.id).slice(0, 8)}`);
      });
      userIds.forEach((id) => { if (!map[id]) map[id] = `User · ${id.slice(0, 8)}`; });
      setNames(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return names;
}

function useMarketInboxThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("market_messages" as any)
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      const map = new Map<string, ThreadSummary>();
      (data as any[] | null)?.forEach((m) => {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const key = (m.thread_key as string) || makeThreadKey(user.id, other);
        if (!map.has(key)) {
          map.set(key, {
            key, other,
            supplyId: m.related_supply_id ?? null,
            orderId: m.related_order_id ?? null,
            lastBody: m.body, unread: 0, lastAt: m.created_at,
          });
        }
        if (m.recipient_id === user.id && !m.read_at) map.get(key)!.unread += 1;
      });
      setThreads(Array.from(map.values()));
    };
    load();
    const ch = supabase
      .channel(`dashboard-market-inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_messages" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [user]);

  return threads;
}

function DashboardMarketInbox({ threads }: { threads: ThreadSummary[] }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ThreadSummary | null>(null);
  const names = useDisplayNames(threads.map((t) => t.other));

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Market Link Messages</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-2 space-y-1">
          {threads.length === 0 && <p className="text-xs text-muted-foreground p-3">No market conversations yet.</p>}
          {threads.map((t) => {
            const displayName = names[t.other] || `User · ${t.other.slice(0, 8)}`;
            return (
              <button key={t.key} onClick={() => setActive(t)} className={`w-full text-left p-2 rounded-md hover:bg-accent ${active?.key === t.key ? "bg-accent" : ""}`}>
                <div className="flex items-center justify-between text-sm font-medium"><span>{displayName}</span>{t.unread > 0 && <Badge>{t.unread}</Badge>}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.lastBody}</div>
              </button>
            );
          })}
        </CardContent></Card>
        <div className="md:col-span-2">{active ? (
          <ChatPanel
            key={active.key}
            otherUserId={active.other}
            otherName={names[active.other] || `User · ${active.other.slice(0, 8)}`}
            relatedSupplyId={active.supplyId || undefined}
            relatedOrderId={active.orderId || undefined}
          />
        ) : <p className="text-sm text-muted-foreground p-6 text-center">Select a message thread.</p>}</div>
      </div>
    </DialogContent>
  );
}

/* ============================================================== */
/*  ContractsPanel — READ-ONLY agreement summary cards.            */
/*  No accept/decline/cancel here. Those happen on Order Listing.  */
/* ============================================================== */
function ContractsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("agreements" as any)
        .select("*")
        .or(`buyer_id.eq.${user.id},supplier_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as any) || []);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`agreements-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agreements" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [user]);

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Loading agreements…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground py-6 text-center">No completed agreements yet. Accept a negotiation from Order Listing to generate one.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((a) => {
        const role = a.buyer_id === user?.id ? "Buyer" : "Supplier";
        return (
          <Card key={a.id}><CardContent className="p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">Agreement · {role}</div>
                <p className="text-xs text-muted-foreground">{Number(a.agreed_quantity).toLocaleString()} {a.unit} · {formatMarketPrice(a.agreed_price, a.unit)}</p>
              </div>
              <Badge variant={a.agreement_status === "active" ? "default" : "outline"} className="capitalize">{a.agreement_status || "active"}</Badge>
            </div>
            {a.delivery_terms && <p className="text-xs text-muted-foreground">Terms: {a.delivery_terms}</p>}
            <p className="text-[11px] text-muted-foreground">Created {new Date(a.created_at).toLocaleDateString()}</p>
          </CardContent></Card>
        );
      })}
    </div>
  );
}


export default function MarketLink() {
  const m = useMarketLink();
  const inboxThreads = useMarketInboxThreads();
  const unreadCount = inboxThreads.reduce((sum, t) => sum + t.unread, 0);
  const [inboxOpen, setInboxOpen] = useState(false);

  const computedPrices = useMemo(() => {
    const grouped: Record<string, { price: PriceRow | undefined; supply: number; demand: number; unit?: string; supplyCount: number; demandCount: number }> = {};
    m.prices.forEach((p) => { grouped[p.crop_name] = { price: p, supply: 0, demand: 0, unit: p.unit, supplyCount: 0, demandCount: 0 }; });
    m.supply.forEach((s: any) => {
      if (!grouped[s.crop_name]) grouped[s.crop_name] = { price: undefined, supply: 0, demand: 0, unit: s.unit, supplyCount: 0, demandCount: 0 };
      grouped[s.crop_name].supply += Number(s.expected_quantity || 0);
      grouped[s.crop_name].supplyCount += 1;
      grouped[s.crop_name].unit ||= s.unit;
    });
    m.orders.forEach((o) => {
      if (!grouped[o.crop_name]) grouped[o.crop_name] = { price: undefined, supply: 0, demand: 0, unit: o.unit, supplyCount: 0, demandCount: 0 };
      grouped[o.crop_name].demand += Number(o.quantity_needed || 0);
      grouped[o.crop_name].demandCount += 1;
      grouped[o.crop_name].unit ||= o.unit;
    });
    return Object.entries(grouped).map(([crop, v]) => {
      const current = v.price?.current_price || 0;
      const trend: PriceRow["trend"] = v.price?.trend || (v.demand > v.supply * 1.1 ? "rising" : v.supply > v.demand * 1.1 ? "falling" : "stable");
      const risk = m.supply.some((s) => s.crop_name === crop && s.risk_level === "high") ? 0.1 : 0;
      const est = estimateMarketPrice({
        cropName: crop,
        existingSupply: m.supply.filter((s: any) => s.crop_name === crop) as any,
        activeBuyerRequests: m.orders.filter((o) => o.crop_name === crop) as any,
      });
      const suggested = v.price?.suggested_price || est.estimatedPrice || suggestPrice(current, v.supply, v.demand, risk);
      return { crop, current, suggested, trend, supply: v.supply, demand: v.demand, unit: v.price?.unit || v.unit || "kg", demandLevel: est.demandLevel, marketActivity: est.marketActivity };
    }).filter((r) => r.supply || r.demand || r.current);
  }, [m.prices, m.supply, m.orders]);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Market Link</h1>
          <p className="text-sm text-muted-foreground">Coordinate supply, demand, contracts and live trade discussions inside AgroClimate.</p>
        </div>
        <Button size="sm" variant="outline" className="relative" onClick={() => setInboxOpen(true)}>
          <Inbox className="h-4 w-4 mr-1" />Messages
          {unreadCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]">{unreadCount}</Badge>}
        </Button>
      </div>

      <OverviewCards totalSupply={m.totalSupply} totalDemand={m.totalDemand} activeContracts={m.activeContracts} balance={m.balance} />

      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 w-full h-auto p-1 gap-1">
          <TabsTrigger value="supply">Supply</TabsTrigger>
          <TabsTrigger value="order-listing">Order Listing</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="potential-buyers">Potential Buyers</TabsTrigger>
          <TabsTrigger value="logistics-matcher">Logistics Matcher</TabsTrigger>
          <TabsTrigger value="agtrans">AGTrans</TabsTrigger>
        </TabsList>

        <TabsContent value="potential-buyers" className="mt-3">
          <PotentialBuyersPanel />
        </TabsContent>

        <TabsContent value="logistics-matcher" className="mt-3">
          <LogisticsMatcherPanel />
        </TabsContent>

        {/*
          SUPPLIER SUPPLY WORKSPACE
          -------------------------
          Form on top, supplier's OWN listings below. Owner-only actions:
          Edit / Delete / View Responses. Negotiate is NEVER rendered here —
          a supplier cannot negotiate with their own product.
        */}
        <TabsContent value="supply" className="mt-3 space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Publish a supply listing</CardTitle></CardHeader><CardContent><SupplyForm onAdded={m.refresh} /></CardContent></Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your supply listings</CardTitle>
              <p className="text-xs text-muted-foreground">Edit, delete or view buyer responses. Buyers negotiate from the public Market Link homepage.</p>
            </CardHeader>
            <CardContent>
              <SupplyList requireAuthForChat={false} allowOwnerActions ownerOnly compact />
            </CardContent>
          </Card>
        </TabsContent>

        {/*
          BUYER ORDER LISTING (role-aware via Orders.tsx)
          -----------------------------------------------
          • Buyer-owned row    → Edit / Save / Delete
          • Other (supplier)   → Negotiate / Accept / Decline
        */}
        <TabsContent value="order-listing" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buyer order listing</CardTitle>
              <p className="text-xs text-muted-foreground">
                Suppliers: open an order to Negotiate, Accept or Decline.
              </p>
            </CardHeader>
            <CardContent>
              <OrderListing scope="global" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completed agreements</CardTitle>
              <p className="text-xs text-muted-foreground">Read-only summary of accepted negotiations. Accept / decline happens on Order Listing.</p>
            </CardHeader>
            <CardContent><ContractsPanel /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices" className="mt-3">
          <Card><CardHeader><CardTitle className="text-base">System estimated prices · demand · activity</CardTitle></CardHeader><CardContent>
            {computedPrices.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No price data yet.</p> : (
              <div className="space-y-2">{computedPrices.map((p) => (
                <div key={p.crop} className="border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{p.crop} {trendIcon(p.trend)} <span className="text-xs text-muted-foreground capitalize">{p.trend}</span></div>
                    <p className="text-xs text-muted-foreground">Supply {p.supply.toLocaleString()} {p.unit} · Demand {p.demand.toLocaleString()} {p.unit}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">Demand: {p.demandLevel}</Badge>
                      <Badge variant="outline" className="text-[10px]">Market: {p.marketActivity}</Badge>
                    </div>
                  </div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Current avg</p><p className="font-semibold">{formatMarketPrice(p.current, p.unit)}</p></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Estimated</p><p className="font-semibold text-primary">{formatMarketPrice(p.suggested, p.unit)}</p></div>
                </div>
              ))}</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="agtrans" className="mt-3">
          <AGTransSupplierPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={inboxOpen} onOpenChange={setInboxOpen}>
        <DashboardMarketInbox threads={inboxThreads} />
      </Dialog>
    </div>
  );
}
