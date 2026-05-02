import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Store, TrendingUp, TrendingDown, Minus, AlertTriangle, Trash2,
  Truck, Handshake, Package, Loader2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  useMarketLink, suggestPrice,
  type FarmerInput, type BuyerOrder, type MarketContract, type PriceRow,
} from "@/hooks/useMarketLink";
import { useProfile } from "@/hooks/useProfile";

const CROPS = ["Maize", "Rice", "Cassava", "Yam", "Tomato", "Pepper", "Onion", "Cocoa", "Plantain", "Beans", "Groundnut"];
const UNITS = ["kg", "bags", "tons", "crates"];

function riskBadge(level: string) {
  if (level === "high") return <Badge className="bg-red-500 text-white">High Risk</Badge>;
  if (level === "medium") return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
  return <Badge className="bg-green-600 text-white">Low</Badge>;
}

function trendIcon(t: string) {
  if (t === "rising") return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  if (t === "falling") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function OverviewCards({
  totalSupply, totalDemand, activeContracts, balance,
}: { totalSupply: number; totalDemand: number; activeContracts: number; balance: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" /> Expected supply</div>
        <p className="text-2xl font-bold mt-1">{totalSupply.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground">units across all listings</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Handshake className="h-4 w-4" /> Active demand</div>
        <p className="text-2xl font-bold mt-1">{totalDemand.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground">units requested by buyers</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4" /> Active contracts</div>
        <p className="text-2xl font-bold mt-1">{activeContracts}</p>
        <p className="text-[11px] text-muted-foreground">proposed or accepted</p>
      </CardContent></Card>
      <Card><CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Balance</div>
        <p className={`text-base font-bold mt-1 capitalize ${
          balance === "shortage" ? "text-red-500" : balance === "surplus" ? "text-yellow-600" : "text-green-600"
        }`}>{balance}</p>
        <p className="text-[11px] text-muted-foreground">
          {balance === "shortage" ? "Demand higher than supply" :
           balance === "surplus" ? "Supply exceeds demand" : "Supply matches demand"}
        </p>
      </CardContent></Card>
    </div>
  );
}

function SupplyForm({ onAdd }: { onAdd: (i: any) => Promise<void> }) {
  const { profile } = useProfile();
  const [crop, setCrop] = useState("Maize");
  const [region, setRegion] = useState(profile?.region || "");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty) return toast.error("Quantity required");
    setBusy(true);
    try {
      await onAdd({
        crop_name: crop, region: region || null, expected_quantity: Number(qty), unit,
        harvest_start: start || null, harvest_end: end || null, risk_level: risk, notes: null,
      });
      setQty(""); setStart(""); setEnd("");
      toast.success("Supply listing added");
    } catch (e: any) { toast.error(e.message || "Failed"); }
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
      <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Greater Accra" /></div>
      <div><Label>Expected quantity</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Harvest start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Harvest end</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div><Label>Climate risk</Label>
        <Select value={risk} onValueChange={(v) => setRisk(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Supply Listing"}
        </Button>
      </div>
    </form>
  );
}

function OrderForm({ onAdd }: { onAdd: (i: any) => Promise<void> }) {
  const { profile } = useProfile();
  const [crop, setCrop] = useState("Maize");
  const [region, setRegion] = useState(profile?.region || "");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [buyerName, setBuyerName] = useState(profile?.display_name || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || !price) return toast.error("Quantity and price required");
    setBusy(true);
    try {
      await onAdd({
        crop_name: crop, region: region || null, quantity_needed: Number(qty), unit,
        target_price: Number(price), delivery_start: start || null, delivery_end: end || null,
        buyer_name: buyerName || null, notes: null,
      });
      setQty(""); setPrice(""); setStart(""); setEnd("");
      toast.success("Order placed");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><Label>Buyer name</Label><Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your business" /></div>
      <div><Label>Crop</Label>
        <Select value={crop} onValueChange={setCrop}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
      <div><Label>Quantity needed</Label><Input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
      <div><Label>Unit</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Target price (per unit)</Label><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      <div><Label>Delivery from</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label>Delivery to</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Place Advance Order"}
        </Button>
      </div>
    </form>
  );
}

function ProposeContractDialog({
  open, onOpenChange, supply, onPropose,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  supply: FarmerInput | null;
  onPropose: (qty: number, price: number, ds: string, de: string) => Promise<void>;
}) {
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [ds, setDs] = useState("");
  const [de, setDe] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!supply) return;
    if (!qty || !price) return toast.error("Quantity and price required");
    setBusy(true);
    try {
      await onPropose(Number(qty), Number(price), ds, de);
      toast.success("Contract proposed");
      onOpenChange(false);
      setQty(""); setPrice(""); setDs(""); setDe("");
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Propose contract</DialogTitle></DialogHeader>
        {supply && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              You're offering to buy <b>{supply.crop_name}</b> from this farmer
              ({Number(supply.expected_quantity).toLocaleString()} {supply.unit} expected
              {supply.region ? ` in ${supply.region}` : ""}).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity ({supply.unit})</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
              <div><Label>Locked price / {supply.unit}</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div><Label>Delivery from</Label><Input type="date" value={ds} onChange={(e) => setDs(e.target.value)} /></div>
              <div><Label>Delivery to</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MarketLink() {
  const m = useMarketLink();
  const [proposeFor, setProposeFor] = useState<FarmerInput | null>(null);

  // Climate-driven supply alerts (very simple rule: any high-risk listing => warning)
  const supplyRisks = useMemo(
    () => m.supply.filter((s) => s.risk_level === "high" && s.status !== "cancelled"),
    [m.supply],
  );

  // Simple price-intel computation per crop using current listings
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
      const current = v.price?.current_price || (v.demand && v.supply ? Math.round((v.demand / Math.max(v.supply, 1)) * 100) / 100 : 0);
      const trend: PriceRow["trend"] = v.price?.trend || (v.demand > v.supply * 1.1 ? "rising" : v.supply > v.demand * 1.1 ? "falling" : "stable");
      const risk = m.supply.some((s) => s.crop_name === crop && s.risk_level === "high") ? 0.1 : 0;
      const suggested = v.price?.suggested_price || suggestPrice(current || v.price?.current_price || 0, v.supply, v.demand, risk);
      return { crop, current, suggested, trend, supply: v.supply, demand: v.demand, unit: v.price?.unit || "kg" };
    }).filter((r) => r.supply || r.demand || r.current);
  }, [m.prices, m.supply, m.orders]);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Market Link</h1>
        <p className="text-sm text-muted-foreground">Coordinate supply, demand and contracts in real-time.</p>
      </div>

      <OverviewCards totalSupply={m.totalSupply} totalDemand={m.totalDemand} activeContracts={m.activeContracts} balance={m.balance} />

      {supplyRisks.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 dark:text-yellow-200 rounded-lg p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div><b>{supplyRisks.length}</b> supply listing{supplyRisks.length > 1 ? "s" : ""} flagged high-risk (climate / weather). Expect possible shortage.</div>
        </div>
      )}

      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="supply">Supply</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
        </TabsList>

        {/* SUPPLY (farmer side + buyer browses) */}
        <TabsContent value="supply" className="mt-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Declare expected harvest</CardTitle></CardHeader>
            <CardContent><SupplyForm onAdd={m.addSupply} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">All supply listings ({m.supply.length})</CardTitle></CardHeader>
            <CardContent>
              {m.supply.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No supply listings yet.</p>
              ) : (
                <div className="space-y-2">
                  {m.supply.map((s) => {
                    const mine = s.user_id === m.user?.id;
                    return (
                      <div key={s.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{s.crop_name}</span>
                            <span className="text-sm text-muted-foreground">{Number(s.expected_quantity).toLocaleString()} {s.unit}</span>
                            {riskBadge(s.risk_level)}
                            <Badge variant="outline" className="capitalize">{s.status}</Badge>
                            {mine && <Badge variant="secondary">Yours</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {s.region || "Region n/a"} · Harvest {s.harvest_start || "?"} → {s.harvest_end || "?"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!mine && s.status !== "cancelled" && (
                            <Button size="sm" onClick={() => setProposeFor(s)}>
                              Propose contract <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          {mine && (
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => m.deleteSupply(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ORDERS (buyer side) */}
        <TabsContent value="orders" className="mt-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Place advance order (buyer)</CardTitle></CardHeader>
            <CardContent><OrderForm onAdd={m.addOrder} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Active demand ({m.orders.length})</CardTitle></CardHeader>
            <CardContent>
              {m.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No buyer orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {m.orders.map((o) => {
                    const mine = o.buyer_id === m.user?.id;
                    return (
                      <div key={o.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{o.crop_name}</span>
                            <span className="text-sm text-muted-foreground">{Number(o.quantity_needed).toLocaleString()} {o.unit} · @ {o.target_price}/{o.unit}</span>
                            <Badge variant="outline" className="capitalize">{o.status}</Badge>
                            {mine && <Badge variant="secondary">Yours</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {o.buyer_name || "Buyer"} · {o.region || "anywhere"} · Deliver {o.delivery_start || "?"} → {o.delivery_end || "?"}
                          </p>
                        </div>
                        {mine && (
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => m.deleteOrder(o.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRACTS */}
        <TabsContent value="contracts" className="mt-3 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contracts ({m.contracts.length})</CardTitle></CardHeader>
            <CardContent>
              {m.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No contracts yet. Buyers can propose from a supply listing.</p>
              ) : (
                <div className="space-y-2">
                  {m.contracts.map((c) => {
                    const isFarmer = c.farmer_id === m.user?.id;
                    const isBuyer = c.buyer_id === m.user?.id;
                    return (
                      <div key={c.id} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{c.crop_name}</span>
                          <span className="text-sm text-muted-foreground">{Number(c.quantity).toLocaleString()} {c.unit} @ {c.locked_price}/{c.unit}</span>
                          <Badge variant="outline" className="capitalize">{c.state}</Badge>
                          <Badge variant="outline" className="capitalize">Logistics: {c.logistics_status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isFarmer ? "You're the farmer." : isBuyer ? "You're the buyer." : ""} Delivery {c.delivery_start || "?"} → {c.delivery_end || "?"}
                        </p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {isFarmer && c.state === "proposed" && (
                            <>
                              <Button size="sm" onClick={() => m.setContractState(c.id, "accepted").then(() => toast.success("Contract accepted"))}>Accept</Button>
                              <Button size="sm" variant="outline" onClick={() => m.setContractState(c.id, "rejected").then(() => toast.message("Contract rejected"))}>Reject</Button>
                            </>
                          )}
                          {(isFarmer || isBuyer) && c.state === "accepted" && (
                            <>
                              <Select value={c.logistics_status} onValueChange={(v) => m.setLogistics(c.id, v as any)}>
                                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="scheduled">Scheduled</SelectItem>
                                  <SelectItem value="in_transit">In transit</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" onClick={() => m.setContractState(c.id, "completed").then(() => toast.success("Marked complete"))}>Mark complete</Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRICES */}
        <TabsContent value="prices" className="mt-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Price intelligence</CardTitle></CardHeader>
            <CardContent>
              {computedPrices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No price data yet. Add supply or orders to see suggestions.</p>
              ) : (
                <div className="space-y-2">
                  {computedPrices.map((p) => (
                    <div key={p.crop} className="border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {p.crop} {trendIcon(p.trend)}
                          <span className="text-xs text-muted-foreground capitalize">{p.trend}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supply {p.supply.toLocaleString()} {p.unit} · Demand {p.demand.toLocaleString()} {p.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Current avg</p>
                        <p className="font-semibold">{p.current ? `${p.current}/${p.unit}` : "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Suggested</p>
                        <p className="font-semibold text-primary">{p.suggested ? `${p.suggested}/${p.unit}` : "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProposeContractDialog
        open={!!proposeFor}
        onOpenChange={(b) => !b && setProposeFor(null)}
        supply={proposeFor}
        onPropose={async (qty, price, ds, de) => {
          if (!proposeFor) return;
          await m.proposeContract({
            farmer_id: proposeFor.user_id,
            farmer_input_id: proposeFor.id,
            crop_name: proposeFor.crop_name,
            quantity: qty, unit: proposeFor.unit, locked_price: price,
            delivery_start: ds || null, delivery_end: de || null,
          });
        }}
      />
    </div>
  );
}
