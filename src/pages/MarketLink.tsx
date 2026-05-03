import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Store, TrendingUp, TrendingDown, Minus, AlertTriangle, Truck, Handshake, Package, Loader2, Image as ImageIcon, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { useMarketLink, suggestPrice, type PriceRow } from "@/hooks/useMarketLink";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SupplyList } from "@/components/market/SupplyList";
import { OrderListing, PlaceOrderForm } from "@/components/market/Orders";
import { Link } from "react-router-dom";

const CROPS = ["Maize", "Rice", "Cassava", "Yam", "Tomato", "Pepper", "Onion", "Cocoa", "Plantain", "Beans", "Groundnut"];
const UNITS = ["kg", "bags", "tons", "crates"];
const CATEGORIES = ["Cereal", "Tuber", "Vegetable", "Fruit", "Legume", "Cash Crop", "Other"];

function trendIcon(t: string) {
  if (t === "rising") return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (t === "falling") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function OverviewCards({ totalSupply, totalDemand, activeContracts, balance }: { totalSupply: number; totalDemand: number; activeContracts: number; balance: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" /> Expected supply</div>
        <p className="text-2xl font-bold mt-1">{totalSupply.toLocaleString()}</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-4 w-4" /> Active demand</div>
        <p className="text-2xl font-bold mt-1">{totalDemand.toLocaleString()}</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4" /> Active contracts</div>
        <p className="text-2xl font-bold mt-1">{activeContracts}</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Balance</div>
        <p className={`text-base font-bold mt-1 capitalize ${
          balance === "shortage" ? "text-red-500" : balance === "surplus" ? "text-yellow-600" : "text-green-600"
        }`}>{balance}</p>
      </CardContent></Card>
    </div>
  );
}

function SupplyForm({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [crop, setCrop] = useState("Maize");
  const [category, setCategory] = useState("Cereal");
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
    if (!qty) { toast.error("Quantity required"); return; }
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
      const { error } = await supabase.from("farmer_inputs" as any).insert({
        user_id: user.id, crop_name: crop, category, region: region || null,
        expected_quantity: Number(qty), unit, quality_grade: grade,
        harvest_start: start || null, harvest_end: end || null,
        delivery_timeline: delivery || null, suggested_price: price ? Number(price) : 0,
        risk_level: risk, image_url,
        contact_email: email || user.email || null, contact_phone: phone || null,
        notes: notes || null,
      } as any);
      if (error) throw error;
      toast.success("Supply listing published");
      setQty(""); setStart(""); setEnd(""); setNotes(""); setFile(null); setPrice("");
      onAdded();
    } catch (err: any) { toast.error(err.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><Label>Crop</Label>
        <Select value={crop} onValueChange={setCrop}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Quantity</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Quality grade</Label>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="A">A — Premium</SelectItem><SelectItem value="B">B — Standard</SelectItem><SelectItem value="C">C — Economy</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Suggested price / {unit}</Label><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <div><Label>Region / location</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Delivery timeline</Label><Input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="e.g. within 14 days" /></div>
      <div><Label>Harvest start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Harvest end</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div><Label>Climate risk</Label>
        <Select value={risk} onValueChange={(v) => setRisk(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Contact email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user?.email || ""} /></div>
      <div><Label>Contact phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>Description / notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="sm:col-span-2"><Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Product image</Label>
        <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish supply listing"}
        </Button>
      </div>
    </form>
  );
}

export default function MarketLink() {
  const m = useMarketLink();
  const [refreshTick, setRefreshTick] = useState(0);

  const computedPrices = useMemo(() => {
    const grouped: Record<string, { price: PriceRow | undefined; supply: number; demand: number }> = {};
    m.prices.forEach((p) => { grouped[p.crop_name] = { price: p, supply: 0, demand: 0 }; });
    m.supply.forEach((s) => {
      if (!grouped[s.crop_name]) grouped[s.crop_name] = { price: undefined, supply: 0, demand: 0 };
      grouped[s.crop_name].supply += Number(s.expected_quantity || 0);
    });
    m.orders.forEach((o) => {
      if (!grouped[o.crop_name]) grouped[o.crop_name] = { price: undefined, supply: 0, demand: 0 };
      grouped[o.crop_name].demand += Number(o.quantity_needed || 0);
    });
    return Object.entries(grouped).map(([crop, v]) => {
      const current = v.price?.current_price || 0;
      const trend: PriceRow["trend"] = v.price?.trend || (v.demand > v.supply * 1.1 ? "rising" : v.supply > v.demand * 1.1 ? "falling" : "stable");
      const risk = m.supply.some((s) => s.crop_name === crop && s.risk_level === "high") ? 0.1 : 0;
      const suggested = v.price?.suggested_price || suggestPrice(current, v.supply, v.demand, risk);
      return { crop, current, suggested, trend, supply: v.supply, demand: v.demand, unit: v.price?.unit || "kg" };
    }).filter((r) => r.supply || r.demand || r.current);
  }, [m.prices, m.supply, m.orders, refreshTick]);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Market Link</h1>
          <p className="text-sm text-muted-foreground">Coordinate supply, demand and contracts in real-time.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/marketplace/inbox"><Button size="sm" variant="outline"><Inbox className="h-4 w-4 mr-1" />Messages</Button></Link>
          <Link to="/marketplace" target="_blank"><Button size="sm" variant="outline">Open Public Marketplace</Button></Link>
        </div>
      </div>

      <OverviewCards totalSupply={m.totalSupply} totalDemand={m.totalDemand} activeContracts={m.activeContracts} balance={m.balance} />

      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="supply">Supply</TabsTrigger>
          <TabsTrigger value="post-order">Place Order</TabsTrigger>
          <TabsTrigger value="order-listing">Order Listing</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Publish a supply listing</CardTitle></CardHeader>
            <CardContent><SupplyForm onAdded={() => setRefreshTick((t) => t + 1)} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">All supply listings</CardTitle></CardHeader>
            <CardContent><SupplyList requireAuthForChat={false} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="post-order" className="mt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Post buyer demand</CardTitle></CardHeader>
            <CardContent><PlaceOrderForm /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order-listing" className="mt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Order Listing</CardTitle></CardHeader>
            <CardContent><OrderListing requireAuthForChat={false} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices" className="mt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Price intelligence</CardTitle></CardHeader>
            <CardContent>
              {computedPrices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No price data yet.</p>
              ) : (
                <div className="space-y-2">
                  {computedPrices.map((p) => (
                    <div key={p.crop} className="border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold flex items-center gap-2">{p.crop} {trendIcon(p.trend)} <span className="text-xs text-muted-foreground capitalize">{p.trend}</span></div>
                        <p className="text-xs text-muted-foreground">Supply {p.supply.toLocaleString()} {p.unit} · Demand {p.demand.toLocaleString()} {p.unit}</p>
                      </div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Current avg</p><p className="font-semibold">{p.current ? `${p.current}/${p.unit}` : "—"}</p></div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Suggested</p><p className="font-semibold text-primary">{p.suggested ? `${p.suggested}/${p.unit}` : "—"}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
