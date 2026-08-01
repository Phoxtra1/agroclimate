import { useState, useMemo, useEffect } from "react";
import { useAGTrans, DriverProfile, TransportRequest } from "@/hooks/useAGTrans";
import { useAuth } from "@/hooks/useAuth";
import { useMarketLink, type MarketContract } from "@/hooks/useMarketLink";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import {
  Truck, MapPin, Route, Calendar, Star, ShieldCheck, Search, AlertCircle, CheckCircle2, XCircle,
  DollarSign, Package, Clock, Eye, Navigation, RotateCcw, History,
} from "lucide-react";
import { toast } from "sonner";

const VEHICLE_FEATURES = [
  "Refrigerated",
  "Covered",
  "Open Bed",
  "Flatbed",
  "Tanker",
  "Livestock Carrier",
  "Other",
];

const CARGO_TYPES = [
  "General Goods",
  "Grains",
  "Maize",
  "Rice",
  "Cassava",
  "Yam",
  "Plantain",
  "Fruits",
  "Vegetables",
  "Eggs",
  "Fish",
  "Meat",
  "Frozen Goods",
  "Livestock",
  "Fertilizer",
  "Cement",
  "Building Materials",
  "Machinery",
  "Other",
];

const ROUTE_FLEXIBILITY = ["Strict Route Only", "Minor Detour Allowed", "Accept Off-Route Requests"];
const PRICING_TYPE = ["Negotiable", "Fixed Price"];

function normalize(s?: string) {
  return (s || "").toLowerCase().trim();
}

function includesAny(haystack?: string, needles?: string[]) {
  if (!haystack || !needles?.length) return false;
  const h = normalize(haystack);
  return needles.some((n) => h.includes(normalize(n)));
}

function validateCompatibility(offer: DriverProfile, order: {
  product?: string;
  quantity?: number;
  weight?: number;
  pickup?: string;
  delivery?: string;
  cargoTypes?: string[];
}) {
  const reasons: string[] = [];

  if (offer.admin_suspended) reasons.push("Driver account is suspended.");
  if (offer.approval_status !== "approved") reasons.push("Driver is not fully approved.");
  if (offer.offer_status !== "published") reasons.push("Transport offer is not published.");
  if (offer.availability_status !== "online") reasons.push("Driver is currently offline or busy.");

  const remaining = Number(offer.remaining_capacity || 0);
  if (remaining <= 0) reasons.push("Driver has no remaining capacity.");

  const requested = Number(order.weight || order.quantity || 0);
  if (requested > 0 && requested > remaining) {
    reasons.push(`Requested capacity (${requested} kg) exceeds remaining capacity (${remaining} kg).`);
  }

  if (order.cargoTypes?.length) {
    const accepted = (offer.cargo_types_accepted || []).map(normalize);
    const matches = order.cargoTypes.some((c) => accepted.includes(normalize(c)));
    if (!matches) {
      reasons.push(`Driver does not accept this cargo type (${order.cargoTypes.join(", ")}).`);
    }
  } else if (order.product) {
    const accepted = (offer.cargo_types_accepted || []).map(normalize);
    if (!accepted.includes(normalize(order.product)) && !accepted.includes("general goods")) {
      reasons.push(`Driver does not accept ${order.product}.`);
    }
  }

  const routeText = [offer.planned_route, offer.current_location_text, offer.pickup_area, offer.destination].filter(Boolean).join(" ");
  const pickupMatch = includesAny(routeText, [order.pickup]);
  const deliveryMatch = includesAny(routeText, [order.delivery]);

  if (offer.route_flexibility === "Strict Route Only") {
    if (!pickupMatch) reasons.push(`Pickup "${order.pickup}" is not on the driver's planned route.`);
    if (!deliveryMatch) reasons.push(`Destination "${order.delivery}" is not on the driver's planned route.`);
  } else if (offer.route_flexibility === "Minor Detour Allowed") {
    if (!pickupMatch && !deliveryMatch) reasons.push(`Neither pickup nor destination are near the driver's route.`);
  }

  if (offer.departure_date) {
    const departure = new Date(offer.departure_date);
    const now = new Date();
    if (departure < now && departure.toDateString() !== now.toDateString()) {
      reasons.push("Driver's departure date is in the past.");
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export function AGTransSupplierPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { drivers, sendTransportRequest, respondToCounter, requests, deliveryJobs, loading } = useAGTrans();
  const { contracts, supply, orders } = useMarketLink();

  const [viewingOffer, setViewingOffer] = useState<DriverProfile | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<DriverProfile | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [incompatReasons, setIncompatReasons] = useState<string[] | null>(null);
  const [requesting, setRequesting] = useState(false);

  const [counterDialog, setCounterDialog] = useState<TransportRequest | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNote, setCounterNote] = useState("");

  // Filters
  const [q, setQ] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [selectedCargo, setSelectedCargo] = useState<string>("");
  const [selectedFeature, setSelectedFeature] = useState<string>("");
  const [minRating, setMinRating] = useState<string>("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [pricingFilter, setPricingFilter] = useState<string>("");

  const availableOffers = useMemo(() => {
    return drivers.filter((d) =>
      d.approval_status === "approved" &&
      !d.admin_suspended &&
      d.offer_status === "published" &&
      d.availability_status === "online" &&
      Number(d.remaining_capacity || 0) > 0
    );
  }, [drivers]);

  const filteredOffers = useMemo(() => {
    return availableOffers.filter((o) => {
      if (q && !normalize(`${o.full_name} ${o.vehicle_type} ${o.current_location_text} ${o.destination}`).includes(normalize(q))) return false;
      if (vehicleType && normalize(o.vehicle_type) !== normalize(vehicleType)) return false;
      if (locationFilter && !normalize(`${o.current_location_text} ${o.pickup_area} ${o.planned_route}`).includes(normalize(locationFilter))) return false;
      if (destinationFilter && !normalize(`${o.destination} ${o.planned_route}`).includes(normalize(destinationFilter))) return false;
      if (selectedCargo && !(o.cargo_types_accepted || []).map(normalize).includes(normalize(selectedCargo))) return false;
      if (selectedFeature && !(o.vehicle_features || []).map(normalize).includes(normalize(selectedFeature))) return false;
      if (minRating && Number(o.driver_rating || 0) < Number(minRating)) return false;
      if (verifiedOnly && o.approval_status !== "approved") return false;
      if (pricingFilter && normalize(o.pricing_type) !== normalize(pricingFilter)) return false;
      return true;
    });
  }, [availableOffers, q, vehicleType, locationFilter, destinationFilter, selectedCargo, selectedFeature, minRating, verifiedOnly, pricingFilter]);

  const myContracts = useMemo(() => {
    return contracts.filter((c) => c.farmer_id === user?.id && (c.state === "accepted" || c.state === "proposed"));
  }, [contracts, user?.id]);

  const myRequests = useMemo(() => {
    return requests.filter((r) => r.supplier_id === user?.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, user?.id]);

  const selectedContract = useMemo(() => {
    return myContracts.find((c) => c.id === selectedContractId) || null;
  }, [myContracts, selectedContractId]);

  const pickupForContract = (contract: MarketContract) => {
    const listing = supply.find((s) => s.id === contract.farmer_input_id);
    return listing?.region || listing?.district || "";
  };

  const deliveryForContract = (contract: MarketContract) => {
    const order = orders.find((o) => o.id === contract.buyer_order_id);
    return order?.region || order?.district || "";
  };

  const openRequest = (offer: DriverProfile) => {
    setSelectedOffer(offer);
    setSelectedContractId(myContracts[0]?.id || "");
    setIncompatReasons(null);
    setNotes("");
    setSupplierPrice("");
    setWeight("");
  };

  const prepareOrder = () => {
    if (!selectedContract || !selectedOffer) return null;
    const listing = supply.find((s) => s.id === selectedContract.farmer_input_id);
    const product = selectedContract.crop_name;
    const quantity = Number(selectedContract.quantity || 0);
    const unit = selectedContract.unit || "kg";
    const pickup = pickupForContract(selectedContract) || selectedOffer.pickup_area || selectedOffer.current_location_text || "";
    const delivery = deliveryForContract(selectedContract) || selectedOffer.destination || "";
    const cargoTypes = selectedContract.crop_name ? [selectedContract.crop_name] : [];
    if (listing?.category) cargoTypes.push(listing.category);
    return {
      id: selectedContract.id,
      product,
      quantity,
      unit,
      weight: weight ? Number(weight) : quantity,
      pickup,
      delivery,
      cargoTypes,
      buyer_id: selectedContract.buyer_id,
    };
  };

  const validateCurrentRequest = () => {
    const order = prepareOrder();
    if (!order || !selectedOffer) return;
    const result = validateCompatibility(selectedOffer, order);
    setIncompatReasons(result.valid ? [] : result.reasons);
    if (!result.valid) toast.error("Incompatible transport offer");
  };

  useEffect(() => {
    validateCurrentRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContractId, weight, selectedOffer]);

  const handleSendRequest = async () => {
    if (!selectedOffer || !selectedContract) return;
    const order = prepareOrder();
    if (!order) return;

    const result = validateCompatibility(selectedOffer, order);
    if (!result.valid) {
      setIncompatReasons(result.reasons);
      toast.error("Request blocked: " + result.reasons[0]);
      return;
    }

    setRequesting(true);
    try {
      await sendTransportRequest({
        offer: selectedOffer,
        order,
        supplier_offer_price: supplierPrice ? Number(supplierPrice) : undefined,
        notes,
      });
      toast.success("Transport request sent to driver");
      setSelectedOffer(null);
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const openCounter = (req: TransportRequest) => {
    setCounterDialog(req);
    setCounterPrice(req.driver_counter_price ? String(req.driver_counter_price) : "");
    setCounterNote("");
  };

  const submitCounter = async () => {
    if (!counterDialog) return;
    const price = Number(counterPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid counter price");
      return;
    }
    try {
      await respondToCounter(counterDialog.id, "counter", {
        supplier_offer_price: price,
        counter_note: counterNote,
      });
      toast.success("Counter offer sent");
      setCounterDialog(null);
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to send counter");
    }
  };

  const acceptCounter = async (req: TransportRequest) => {
    try {
      await respondToCounter(req.id, "accept");
      toast.success("Counter offer accepted. Transport agreement created.");
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to accept");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm">Loading transport marketplace…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Transport Marketplace</CardTitle>
          <CardDescription>Browse published transport offers and request a driver for your marketplace orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search driver, route, vehicle" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Input placeholder="Current location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
            <Input placeholder="Destination" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)} />
            <Input placeholder="Vehicle type" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
            <Select value={selectedCargo} onValueChange={setSelectedCargo}>
              <SelectTrigger><SelectValue placeholder="Cargo type" /></SelectTrigger>
              <SelectContent>{CARGO_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedFeature} onValueChange={setSelectedFeature}>
              <SelectTrigger><SelectValue placeholder="Vehicle feature" /></SelectTrigger>
              <SelectContent>{VEHICLE_FEATURES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={pricingFilter || "any"} onValueChange={(v) => setPricingFilter(v === "any" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Pricing type" /></SelectTrigger>
              <SelectContent><SelectItem value="any">Any</SelectItem>{PRICING_TYPE.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={minRating || "any"} onValueChange={(v) => setMinRating(v === "any" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Min rating" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="4">4+</SelectItem>
                <SelectItem value="3">3+</SelectItem>
                <SelectItem value="2">2+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input id="verified" type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-primary h-4 w-4" />
            <Label htmlFor="verified" className="text-sm font-normal">Verified drivers only</Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOffers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Truck className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {drivers.length === 0
                ? "No transport offers are available right now."
                : "No published transport offers match your filters."}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {drivers.length === 0
                ? "Approved drivers will publish their offers here. Check back soon or clear your filters."
                : "Try adjusting your search filters to see more results."}
            </p>
          </div>
        ) : (
          filteredOffers.map((offer) => (
            <Card key={offer.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted overflow-hidden">
                    {offer.driver_photo_url ? <img src={offer.driver_photo_url} alt={offer.full_name} className="h-full w-full object-cover" /> : <Truck className="h-6 w-6 m-3 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{offer.full_name}</CardTitle>
                    <CardDescription className="truncate">{offer.vehicle_type} · {offer.plate_number}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs font-semibold"><Star className="h-3 w-3" />{Number(offer.driver_rating || 0).toFixed(1)}</div>
                    {offer.approval_status === "approved" && <Badge variant="outline" className="text-[10px] gap-1"><ShieldCheck className="h-3 w-3" />Verified</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><div className="text-[10px] text-muted-foreground uppercase">Capacity</div><div>{offer.remaining_capacity} / {offer.vehicle_capacity_kg} kg</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Pricing</div><div>{offer.pricing_type}</div></div>
                  <div className="col-span-2"><div className="text-[10px] text-muted-foreground uppercase">Route</div><div>{offer.current_location_text} → {offer.destination}</div></div>
                  <div className="col-span-2"><div className="text-[10px] text-muted-foreground uppercase">Planned</div><div>{offer.planned_route}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">Departure</div><div>{offer.departure_date} {offer.departure_time}</div></div>
                  <div><div className="text-[10px] text-muted-foreground uppercase">ETA</div><div>{offer.estimated_arrival}</div></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(offer.cargo_types_accepted || []).slice(0, 5).map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingOffer(offer)}><Eye className="h-4 w-4 mr-1" /> View Details</Button>
                <Button size="sm" onClick={() => openRequest(offer)}>Request Driver</Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* My Transport Requests */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> My Transport Requests</CardTitle></CardHeader>
        <CardContent>
          {myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">You haven't requested any drivers yet.</p>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div key={req.id} className="border rounded-lg p-3 flex flex-col md:flex-row justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm">{req.product_type} · {req.quantity} {req.unit}</div>
                    <div className="text-xs text-muted-foreground">{req.pickup_location} → {req.delivery_location}</div>
                    <div className="text-xs text-muted-foreground">Status: {req.negotiation_status || req.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {req.negotiation_status === "counter" && (
                      <>
                        <Button size="sm" onClick={() => acceptCounter(req)}><CheckCircle2 className="h-4 w-4 mr-1" /> Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => openCounter(req)}><RotateCcw className="h-4 w-4 mr-1" /> Counter</Button>
                      </>
                    )}
                    {req.status === "accepted" && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/live-tracking/${req.id}`)}><Navigation className="h-4 w-4 mr-1" /> Track</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewingOffer} onOpenChange={() => setViewingOffer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewingOffer?.full_name}</DialogTitle></DialogHeader>
          {viewingOffer && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Vehicle</span><div>{viewingOffer.vehicle_type}</div></div>
                <div><span className="text-muted-foreground">Plate</span><div>{viewingOffer.plate_number}</div></div>
                <div><span className="text-muted-foreground">Capacity</span><div>{viewingOffer.remaining_capacity} / {viewingOffer.vehicle_capacity_kg} kg</div></div>
                <div><span className="text-muted-foreground">Pricing</span><div>{viewingOffer.pricing_type}</div></div>
              </div>
              <div><span className="text-muted-foreground">Route</span><div>{viewingOffer.current_location_text} → {viewingOffer.destination}</div></div>
              <div><span className="text-muted-foreground">Planned</span><div>{viewingOffer.planned_route}</div></div>
              <div><span className="text-muted-foreground">Departure</span><div>{viewingOffer.departure_date} {viewingOffer.departure_time} · ETA {viewingOffer.estimated_arrival}</div></div>
              <div><span className="text-muted-foreground">Features</span><div className="flex flex-wrap gap-1">{(viewingOffer.vehicle_features || []).map((f) => <Badge key={f} variant="outline">{f}</Badge>)}</div></div>
              <div><span className="text-muted-foreground">Cargo accepted</span><div className="flex flex-wrap gap-1">{(viewingOffer.cargo_types_accepted || []).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingOffer(null)}>Close</Button>
            <Button onClick={() => { setViewingOffer(null); openRequest(viewingOffer!); }}>Request Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Driver Dialog */}
      <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Request Driver: {selectedOffer?.full_name}</DialogTitle></DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Marketplace Order</Label>
                <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                  <SelectTrigger><SelectValue placeholder="Choose an active order" /></SelectTrigger>
                  <SelectContent>
                    {myContracts.length === 0 && <SelectItem value="">No active orders</SelectItem>}
                    {myContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.crop_name} · {c.quantity} {c.unit} · GHS {c.locked_price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContract && (
                <div className="bg-muted/30 p-3 rounded-lg text-sm space-y-1">
                  <div><span className="text-muted-foreground">Product:</span> {selectedContract.crop_name}</div>
                  <div><span className="text-muted-foreground">Quantity:</span> {selectedContract.quantity} {selectedContract.unit}</div>
                  <div><span className="text-muted-foreground">Pickup:</span> {pickupForContract(selectedContract) || "—"}</div>
                  <div><span className="text-muted-foreground">Delivery:</span> {deliveryForContract(selectedContract) || "—"}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cargo Weight (kg)</Label>
                  <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={String(selectedContract?.quantity || "")} />
                </div>
                <div className="space-y-2">
                  <Label>Your Offer Price (GHS)</Label>
                  <Input type="number" value={supplierPrice} onChange={(e) => setSupplierPrice(e.target.value)} placeholder={String(selectedContract?.locked_price || "")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {incompatReasons && incompatReasons.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                  <div className="font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Incompatible offer</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {incompatReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                  <p className="text-xs">Please select another Transport Offer or adjust your cargo details.</p>
                </div>
              )}

              {incompatReasons && incompatReasons.length === 0 && (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> This offer is compatible with your order.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOffer(null)}>Cancel</Button>
            <Button onClick={handleSendRequest} disabled={requesting || (incompatReasons !== null && incompatReasons.length > 0)}>
              {requesting ? "Sending…" : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Offer Dialog */}
      <Dialog open={!!counterDialog} onOpenChange={() => setCounterDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Counter Offer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Counter Price (GHS)</Label>
              <Input type="number" value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea value={counterNote} onChange={(e) => setCounterNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterDialog(null)}>Cancel</Button>
            <Button onClick={submitCounter}>Send Counter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
