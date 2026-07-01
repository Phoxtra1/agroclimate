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
  Loader2, Image as ImageIcon, Inbox, Route, Eye, MessageSquare, CalendarRange, Clock, Navigation, CheckCircle
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
import { useAGTrans, DriverProfile, TransportRequest } from "@/hooks/useAGTrans";
import { estimateMarketPrice } from "@/lib/pricingEngine";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
} catch {}

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
      let payload: Record<string, any> = { ...basePayload, ...optionalPayload };
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

interface ThreadSummary { other: string; lastBody: string; unread: number; lastAt: string; }

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
        const key = makeThreadKey(user.id, other);
        if (!map.has(key)) map.set(key, { other, lastBody: m.body, unread: 0, lastAt: m.created_at });
        if (m.recipient_id === user.id && !m.read_at) map.get(key)!.unread += 1;
      });
      setThreads(Array.from(map.values()));
    };
    load();
    const ch = supabase
      .channel(`dashboard-market-inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_messages" }, load)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [user]);

  return threads;
}

function DashboardMarketInbox({ threads }: { threads: ThreadSummary[] }) {
  const { user } = useAuth();
  const [active, setActive] = useState<string | null>(null);
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
              <button key={t.other} onClick={() => setActive(t.other)} className={`w-full text-left p-2 rounded-md hover:bg-accent ${active === t.other ? "bg-accent" : ""}`}>
                <div className="flex items-center justify-between text-sm font-medium"><span>{displayName}</span>{t.unread > 0 && <Badge>{t.unread}</Badge>}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.lastBody}</div>
              </button>
            );
          })}
        </CardContent></Card>
        <div className="md:col-span-2">{active ? <ChatPanel key={`${user?.id}-${active}`} otherUserId={active} otherName={names[active] || `User · ${active.slice(0, 8)}`} /> : <p className="text-sm text-muted-foreground p-6 text-center">Select a message thread.</p>}</div>
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
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [user?.id]);

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

function AGTransSupplierPanel() {
  const { createRequest, requests, deliveryJobs, trackingSessions, drivers, confirmDelivery } = useAGTrans();
  const { user } = useAuth();
  
  const [subTab, setSubTab] = useState<"requests" | "drivers">("requests");

  // Form states
  const [cargo, setCargo] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [urgency, setUrgency] = useState("standard");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [viewingDriver, setViewingDriver] = useState<DriverProfile | null>(null);
  const [chatDriver, setChatDriver] = useState<DriverProfile | null>(null);
  const [bookingDriver, setBookingDriver] = useState<DriverProfile | null>(null);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);

  const myRequests = requests.filter(r => r.supplier_id === user?.id);
  const onlineDrivers = drivers.filter(d => d.availability_status === "online" && d.verification_status === "verified");

  const handleSubmit = async (e: React.FormEvent, directDriverId?: string) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createRequest({
        product_type: cargo,
        quantity: Number(qty),
        unit,
        pickup_location: pickup,
        delivery_location: dropoff,
        preferred_pickup_at: pickupTime || undefined,
        urgency,
        estimated_price: Number(price),
        notes,
        driver_id: directDriverId || undefined,
      });

      toast.success(directDriverId 
        ? "Direct request sent! The driver has been notified." 
        : "Transport request broadcasted to AGTrans network!");
      
      setCargo(""); setQty(""); setPickup(""); setDropoff(""); setPickupTime(""); setUrgency("standard"); setPrice(""); setNotes("");
      setBookingDriver(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const activeTrackingJob = deliveryJobs.find(j => j.id === trackingJobId);
  const activeTrackingSession = activeTrackingJob ? trackingSessions.find(s => s.delivery_job_id === activeTrackingJob.id) : null;

  // Mock map coordinates for tracking display
  const defaultPickup: [number, number] = [5.6037, -0.1870]; // Accra
  const defaultDropoff: [number, number] = [6.6961, -1.6152]; // Kumasi
  const currentPos: [number, number] = activeTrackingSession?.current_lat && activeTrackingSession?.current_lon 
    ? [activeTrackingSession.current_lat, activeTrackingSession.current_lon] 
    : defaultPickup;

  // Custom marker icons
  const pickupIcon = L.divIcon({
    html: `<div class="bg-blue-500 w-3 h-3 rounded-full border border-white shadow-sm"></div>`,
    className: "custom-pin",
  });
  const dropoffIcon = L.divIcon({
    html: `<div class="bg-red-500 w-3 h-3 rounded-full border border-white shadow-sm"></div>`,
    className: "custom-pin",
  });
  const truckIcon = L.divIcon({
    html: `<div class="bg-emerald-500 p-1.5 rounded-full border border-white shadow-lg text-white" style="transform: rotate(${activeTrackingSession?.heading || 0}deg);">
      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
    </div>`,
    className: "truck-pin",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <div className="space-y-6">
      {/* Sub Tabs Toggle */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={subTab === "requests" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setSubTab("requests")}
          className="font-semibold"
        >
          Requests & Tracking
        </Button>
        <Button 
          variant={subTab === "drivers" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setSubTab("drivers")}
          className="font-semibold flex items-center gap-2"
        >
          Find Drivers <Badge variant="secondary" className="h-5 px-1.5 rounded-full">{onlineDrivers.length}</Badge>
        </Button>
      </div>

      {subTab === "requests" && (
        <div className="space-y-6">
          {/* Create Request Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Route className="h-5 w-5 text-primary" /> Create Transport Request
              </CardTitle>
              <p className="text-xs text-muted-foreground">Broadcast your logistics needs to verified AGTrans drivers. AI handles optimal routing and pricing validation.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Cargo Type</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="e.g. Maize, Tomatoes" required /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
                  <div><Label>Unit</Label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div><Label>Pickup Location</Label><Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Farm or Warehouse address" required /></div>
                <div><Label>Dropoff Location</Label><Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Market or Buyer address" required /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Preferred Pickup Time</Label><Input type="datetime-local" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required /></div>
                  <div>
                    <Label>Urgency</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="express">Express</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Price Offer (GHS)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Your budget" required /></div>
                <div className="sm:col-span-2"><Label>Notes/Instructions</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special handling instructions?" rows={2} /></div>
                <div className="sm:col-span-2"><Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Broadcast Request"}</Button></div>
              </form>
            </CardContent>
          </Card>

          {/* Active Requests List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Active Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active transport requests.</p>
              ) : (
                myRequests.map(req => {
                  const job = deliveryJobs.find(j => j.product === req.product_type && j.supplier_id === user?.id && j.status !== "Cancelled");
                  return (
                    <div key={req.id} className="border rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card shadow-sm hover:shadow transition">
                      <div>
                        <div className="font-semibold text-lg">{req.product_type} <span className="text-xs font-normal text-muted-foreground">({req.quantity} {req.unit})</span></div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {req.pickup_location} → {req.delivery_location}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-1">
                          Tracking ID: {req.tracking_code} <CopyButton value={req.tracking_code || ""} className="h-4 w-4" />
                        </div>
                        {job && (
                          <div className="text-xs font-semibold text-primary mt-2">
                            Delivery job: {job.status}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end w-full md:w-auto">
                        <div className="flex gap-2 items-center">
                          <Badge variant={req.status === "delivered" ? "default" : req.status === "in_transit" ? "secondary" : "outline"} className="uppercase">
                            {req.status.replace("_", " ")}
                          </Badge>
                          <span className="font-black text-lg">GHS {req.estimated_price}</span>
                        </div>

                        {job && job.status === "In Transit" && (
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700 w-full text-xs font-bold"
                            onClick={() => setTrackingJobId(job.id)}
                          >
                            <Navigation className="h-3 w-3 mr-1" /> Track Delivery
                          </Button>
                        )}

                        {req.status === "delivered" && (
                          <Button 
                            size="sm" 
                            className="w-full text-xs font-bold" 
                            onClick={async () => {
                              try {
                                await confirmDelivery(req.id);
                                toast.success("Delivery confirmed securely.");
                              } catch (e) {
                                toast.error("Failed to confirm delivery");
                              }
                            }}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm Delivery
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {subTab === "drivers" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> Available Transport Partners
            </CardTitle>
            <p className="text-xs text-muted-foreground">Browse online verified drivers ready for immediate transport negotiation.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {onlineDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No drivers are currently online. Check back later.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {onlineDrivers.map(drv => (
                  <div key={drv.id} className="border p-4 rounded-xl space-y-3 bg-muted/5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-base">{drv.full_name}</h4>
                          <p className="text-xs text-muted-foreground capitalize">{drv.vehicle_type} · Cap: {drv.vehicle_capacity_kg} kg</p>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 font-bold border-0">
                          {drv.reliability_score}% Reliable
                        </Badge>
                      </div>

                      <div className="mt-3 text-xs space-y-1 text-muted-foreground border-t pt-2 border-border/40">
                        <p><strong>Rates:</strong> {drv.rate_information || "Negotiable"}</p>
                        <p><strong>Corridors:</strong> {drv.preferred_corridors?.join(", ") || "All Regions"}</p>
                        <p><strong>Specialties:</strong> {drv.cargo_categories?.join(", ") || "General Cargo"}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <Button size="sm" variant="outline" onClick={() => setViewingDriver(drv)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Profile
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setChatDriver(drv)}>
                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
                      </Button>
                      <Button size="sm" onClick={() => {
                        setBookingDriver(drv);
                        setSubTab("requests");
                      }}>
                        Book Direct
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog: View Driver Profile */}
      <Dialog open={!!viewingDriver} onOpenChange={() => setViewingDriver(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Driver Profile: {viewingDriver?.full_name}</DialogTitle>
          </DialogHeader>
          {viewingDriver && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b pb-3 border-border/40">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Vehicle</span>
                  <span className="font-semibold">{viewingDriver.vehicle_type}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Plate Number</span>
                  <span className="font-semibold">{viewingDriver.plate_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">License Class</span>
                  <span className="font-semibold">{viewingDriver.license_class}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Reliability</span>
                  <span className="font-semibold text-emerald-600">{viewingDriver.reliability_score}%</span>
                </div>
              </div>

              <div className="space-y-2 border-b pb-3 border-border/40">
                <h5 className="font-bold text-xs text-muted-foreground uppercase">Verification Check</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Identity Valid</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> License Active</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Cargo Insurance</span>
                  <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Roadworthiness</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Service Areas & Corridors</span>
                <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-xl border border-border/40 leading-relaxed">
                  {viewingDriver.preferred_corridors?.join(", ") || "All Regions"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Chat with Driver */}
      <Dialog open={!!chatDriver} onOpenChange={() => setChatDriver(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chatting with {chatDriver?.full_name}</DialogTitle>
          </DialogHeader>
          {chatDriver && (
            <ChatPanel
              otherUserId={chatDriver.user_id}
              otherName={`${chatDriver.full_name} (Driver)`}
              otherRole={"driver" as any}
              defaultUnit="kg"
              defaultPrice={100}
              defaultQuantity={100}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Booking Direct Form (displays overlay above request tab) */}
      <Dialog open={!!bookingDriver} onOpenChange={() => setBookingDriver(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book {bookingDriver?.full_name} Directly</DialogTitle>
          </DialogHeader>
          {bookingDriver && (
            <form onSubmit={(e) => handleSubmit(e, bookingDriver.user_id)} className="space-y-3 text-sm">
              <div><Label>Cargo Type</Label><Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="e.g. Maize, Tomatoes" required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Quantity</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
                <div><Label>Unit</Label><Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MARKET_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div><Label>Pickup Location</Label><Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Farm or Warehouse address" required /></div>
              <div><Label>Dropoff Location</Label><Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Market or Buyer address" required /></div>
              <div><Label>Target Price Offer (GHS)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price Offer" required /></div>
              <div><Label>Preferred Pickup Time</Label><Input type="datetime-local" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required /></div>
              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Direct Booking Offer"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Realtime Shipment Tracking Modal */}
      <Dialog open={!!trackingJobId} onOpenChange={() => setTrackingJobId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Live Tracking Session: {activeTrackingJob?.product}</DialogTitle>
          </DialogHeader>
          {activeTrackingJob && (
            <div className="space-y-4">
              <div className="h-[350px] rounded-xl overflow-hidden border">
                <MapContainer center={currentPos} zoom={8} className="h-full w-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={defaultPickup} icon={pickupIcon}>
                    <Popup>Pickup: {activeTrackingJob.pickup_location}</Popup>
                  </Marker>
                  <Marker position={defaultDropoff} icon={dropoffIcon}>
                    <Popup>Dropoff: {activeTrackingJob.destination}</Popup>
                  </Marker>
                  {activeTrackingSession && (
                    <Marker position={currentPos} icon={truckIcon}>
                      <Popup>
                        <strong>{activeTrackingSession.driver_name}</strong><br />
                        Speed: {activeTrackingSession.speed_kn} km/h<br />
                        Plate: {activeTrackingSession.plate_number}
                      </Popup>
                    </Marker>
                  )}
                  {activeTrackingSession?.route && (
                    <Polyline positions={activeTrackingSession.route} color="#10b981" weight={4} dashArray="5, 10" />
                  )}
                </MapContainer>
              </div>

              {activeTrackingSession && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border p-4 rounded-xl bg-muted/10">
                  <div>
                    <span className="text-muted-foreground block font-bold text-[9px] uppercase">Driver Name</span>
                    <span className="font-semibold text-sm">{activeTrackingSession.driver_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-bold text-[9px] uppercase">Speed</span>
                    <span className="font-semibold text-sm">{activeTrackingSession.speed_kn || 0} km/h</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-bold text-[9px] uppercase">ETA</span>
                    <span className="font-semibold text-sm text-primary">{activeTrackingSession.eta || "Calculating..."}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-bold text-[9px] uppercase">Distance left</span>
                    <span className="font-semibold text-sm">
                      {activeTrackingSession.distance_m ? `${Math.round(activeTrackingSession.distance_m / 1000)} km` : "Pending..."}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="supply">Supply</TabsTrigger>
          <TabsTrigger value="order-listing">Order Listing</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="agtrans">AGTrans (Logistics)</TabsTrigger>
        </TabsList>

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
