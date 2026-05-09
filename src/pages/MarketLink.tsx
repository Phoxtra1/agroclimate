import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Store, TrendingUp, TrendingDown, Minus, Package, Loader2, Inbox, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SupplyList } from "@/components/market/SupplyList";
import { OrderListing } from "@/components/market/Orders";
import Agreement from "@/components/market/Agreement";
import { MARKET_UNITS, parseMarketPrice, formatMarketPrice } from "@/lib/market";
import {
  estimateMarketPrice, type SupplyLike, type DemandLike,
} from "@/lib/pricingEngine";

const CATEGORIES = ["Cereal", "Tuber", "Vegetable", "Fruit", "Legume", "Livestock", "Fish", "Mineral", "Raw Material", "Refined Material", "Other"];

export default function MarketLink() {
  const { user } = useAuth();
  const [supplyRows, setSupplyRows] = useState<SupplyLike[]>([]);
  const [demandRows, setDemandRows] = useState<DemandLike[]>([]);

  // Pull a small slice of recent rows so the pricing engine has signal.
  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: d }] = await Promise.all([
        supabase.from("farmer_inputs" as any).select("crop_name,region,category,expected_quantity,unit,suggested_price,status").neq("status", "cancelled").limit(500),
        supabase.from("buyer_orders"  as any).select("crop_name,region,quantity_needed,unit,target_price,status").neq("status", "cancelled").limit(500),
      ]);
      setSupplyRows((s as any) || []);
      setDemandRows((d as any) || []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Store className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Market Link</h2>
      </div>

      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="supply">Supply</TabsTrigger>
          <TabsTrigger value="price">Price</TabsTrigger>
          <TabsTrigger value="orders">Order Listings</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
        </TabsList>

        {/* ---------------- OVERVIEW ---------------- */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI icon={Package} label="Listings" value={supplyRows.length} />
            <KPI icon={Inbox}   label="Active demand" value={demandRows.length} />
            <KPI icon={TrendingUp} label="Hot products" value={Math.min(demandRows.length, 5)} />
            <KPI icon={Store} label="Status" value={user ? "Connected" : "Sign in"} />
          </div>
        </TabsContent>

        {/* ---------------- SUPPLY ----------------- */}
        <TabsContent value="supply">
          <Card>
            <CardHeader><CardTitle className="text-base">Publish a supply listing</CardTitle></CardHeader>
            <CardContent>
              <SupplyForm supplyRows={supplyRows} demandRows={demandRows} />
            </CardContent>
          </Card>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">My listings</h3>
            {/* Owner-only: Edit / Delete / View Responses. NO Negotiate. */}
            <SupplyList ownerOnly allowOwnerActions requireAuthForChat={false} compact />
          </div>
        </TabsContent>

        {/* ---------------- PRICE ------------------ */}
        <TabsContent value="price">
          <PricePanel supplyRows={supplyRows} demandRows={demandRows} />
        </TabsContent>

        {/* ---------------- ORDER LISTINGS --------- */}
        <TabsContent value="orders">
          {/* Buyer-created orders. Role-aware row actions handled inside. */}
          <OrderListing />
        </TabsContent>

        {/* ---------------- AGREEMENTS ------------- */}
        <TabsContent value="agreements">
          <Agreement role="both" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================== */
/*  SupplyForm — supplier publishes + sees live price estimate.    */
/* ============================================================== */
function SupplyForm({ supplyRows, demandRows }: { supplyRows: SupplyLike[]; demandRows: DemandLike[] }) {
  const { user } = useAuth();
  const [crop, setCrop] = useState("");
  const [category, setCategory] = useState("Cereal");
  const [region, setRegion] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const estimate = useMemo(() => {
    if (!crop.trim()) return null;
    return estimateMarketPrice({
      cropName: crop, region, category,
      quantity: Number(qty || 0), unit,
      existingSupply: supplyRows, activeBuyerRequests: demandRows,
    });
  }, [crop, region, category, qty, unit, supplyRows, demandRows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Sign in to publish"); return; }
    if (!crop.trim() || !qty) { toast.error("Product and quantity required"); return; }
    setBusy(true);
    try {
      const finalPrice = price.trim() ? parseMarketPrice(price) : (estimate?.estimatedPrice || 0);
      const { error } = await supabase.from("farmer_inputs" as any).insert({
        user_id: user.id,
        crop_name: crop.trim(),
        category, region: region || null,
        expected_quantity: Number(qty), unit,
        suggested_price: finalPrice,
        price_label: price.trim() || (estimate?.priceLabel ?? null),
        estimated_price: estimate?.estimatedPrice ?? null,
        demand_level: estimate?.demandLevel ?? null,
        listing_status: "active",
        notes: notes || null,
        status: "active",
      } as any);
      if (error) throw error;
      toast.success("Supply listing published");
      setCrop(""); setQty(""); setPrice(""); setNotes("");
    } catch (err: any) { toast.error(err.message || "Failed to publish"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div><Label>Product</Label><Input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="Maize, cassava, tilapia…" required /></div>
      <div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Price (optional — auto-estimated)</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={estimate?.priceLabel || "GHS 4,500"} /></div>
      <div className="md:col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

      {estimate && (
        <div className="md:col-span-2 rounded-lg border bg-muted/40 p-3 flex items-center gap-3 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">Estimated Market Price:</span> {estimate.priceLabel}
          </div>
          <Badge variant="secondary">Demand: {estimate.demandLevel}</Badge>
          <Badge variant="outline">Activity: {estimate.marketActivity}</Badge>
          <span className="text-xs text-muted-foreground">{estimate.explain}</span>
        </div>
      )}

      <div className="md:col-span-2"><Button type="submit" disabled={busy} className="w-full h-10">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish to Market Link"}</Button></div>
    </form>
  );
}

/* ============================================================== */
/*  PricePanel — read-only estimated market price browser.         */
/* ============================================================== */
function PricePanel({ supplyRows, demandRows }: { supplyRows: SupplyLike[]; demandRows: DemandLike[] }) {
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [unit, setUnit] = useState("kg");

  const est = useMemo(() => crop.trim() ? estimateMarketPrice({
    cropName: crop, region, unit,
    existingSupply: supplyRows, activeBuyerRequests: demandRows,
  }) : null, [crop, region, unit, supplyRows, demandRows]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Estimated market price</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Product (e.g. Maize)" value={crop} onChange={(e) => setCrop(e.target.value)} />
          <Input placeholder="Region (optional)" value={region} onChange={(e) => setRegion(e.target.value)} />
          <Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
        </div>

        {est ? (
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-2xl font-bold">{est.priceLabel}</div>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant="secondary">Demand: {est.demandLevel}</Badge>
              <Badge variant="outline">Activity: {est.marketActivity}</Badge>
              <span className="text-xs text-muted-foreground">{est.explain}</span>
            </div>
            <div className="text-xs text-muted-foreground">Supply samples: {est.supplyCount} · Buyer requests: {est.demandCount}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Enter a product to see the estimated market price.</p>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card><CardContent className="pt-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
      <p className="text-2xl font-bold mt-1">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </CardContent></Card>
  );
}

/* Helpers re-exported in case other dashboards want trend pills. */
export function trendIcon(t: string) {
  if (t === "rising") return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (t === "falling") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}
export { formatMarketPrice };
