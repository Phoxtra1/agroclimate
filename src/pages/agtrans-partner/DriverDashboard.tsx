import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAGTrans, TransportRequest, DeliveryJob, DriverProfile, AvailabilityStatus } from "@/hooks/useAGTrans";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Truck, DollarSign, Package, Star, Navigation, Pause, X,
  CheckCircle2, RotateCcw, Eye, History, ClipboardList, Settings, Map,
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

const ROUTE_FLEXIBILITY = [
  "Strict Route Only",
  "Minor Detour Allowed",
  "Accept Off-Route Requests",
];

const AVAILABILITY = [
  { value: "online", label: "Online" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
  { value: "full_capacity", label: "Full Capacity" },
];

const PRICING_TYPE = ["Negotiable", "Fixed Price"];

const DELIVERY_STATUSES: DeliveryJob["status"][] = [
  "Assigned",
  "Driver En Route",
  "Loading",
  "Picked Up",
  "In Transit",
  "Near Delivery",
  "Delivered",
  "Completed",
];

function statusBadge(status?: string) {
  switch (status) {
    case "published":
    case "approved":
    case "Completed":
    case "accepted":
      return <Badge variant="default">{status}</Badge>;
    case "pending":
    case "Assigned":
      return <Badge variant="secondary">{status}</Badge>;
    case "paused":
    case "offline":
    case "more_info":
      return <Badge variant="outline">{status}</Badge>;
    case "rejected":
    case "declined":
    case "Cancelled":
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    requests,
    deliveryJobs,
    driverProfile,
    loading,
    publishOffer,
    pauseOffer,
    removeOffer,
    respondToRequest,
    updateDeliveryJobStatus,
    handleCancelTrip,
    toggleAvailability,
  } = useAGTrans();

  const tabParam = searchParams.get("tab") || "offer";
  const [activeTab, setActiveTab] = useState(tabParam);
  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  const [offerForm, setOfferForm] = useState<Partial<DriverProfile>>({});
  const [editingOffer, setEditingOffer] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);

  const [counterDialog, setCounterDialog] = useState<TransportRequest | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterNote, setCounterNote] = useState("");

  const [statusDialog, setStatusDialog] = useState<DeliveryJob | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DeliveryJob["status"]>("Assigned");

  const [cancelDialog, setCancelDialog] = useState<DeliveryJob | null>(null);

  useEffect(() => {
    if (driverProfile) setOfferForm(driverProfile);
  }, [driverProfile]);

  useEffect(() => {
    if (!loading && !driverProfile) {
      navigate("/agtrans-partner/onboarding");
    }
  }, [driverProfile, loading, navigate]);

  const myRequests = useMemo(
    () =>
      requests.filter(
        (r) => r.driver_id === user?.id || r.transport_offer_id === driverProfile?.id
      ),
    [requests, user?.id, driverProfile?.id]
  );

  const myActiveJobs = useMemo(
    () =>
      deliveryJobs.filter(
        (j) => j.driver_id === user?.id && j.status !== "Completed" && j.status !== "Cancelled"
      ),
    [deliveryJobs, user?.id]
  );

  const myCompletedJobs = useMemo(
    () => deliveryJobs.filter((j) => j.driver_id === user?.id && j.status === "Completed"),
    [deliveryJobs, user?.id]
  );

  const myCancelledJobs = useMemo(
    () => deliveryJobs.filter((j) => j.driver_id === user?.id && j.status === "Cancelled"),
    [deliveryJobs, user?.id]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted-foreground">
        Loading AGTrans Partner dashboard…
      </div>
    );
  }

  if (!driverProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-6">
        <Truck className="h-10 w-10 text-primary" />
        <h2 className="text-xl font-bold">Complete driver onboarding to continue</h2>
        <Button onClick={() => navigate("/agtrans-partner/onboarding")}>Start Onboarding</Button>
      </div>
    );
  }

  const published = driverProfile.offer_status === "published";

  const setField = (key: keyof DriverProfile, value: string | number) => {
    setOfferForm((prev) => ({ ...(prev || {}), [key]: value } as unknown as Partial<DriverProfile>));
  };

  const toggleArray = (key: keyof DriverProfile, value: string, list: string[]) => {
    setOfferForm((prev) => {
      const current = ((prev?.[key] as string[]) || []).filter((v) => list.includes(v));
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...(prev || {}), [key]: next } as unknown as Partial<DriverProfile>;
    });
  };

  const handlePublishOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile) return;

    const required = ["current_location_text", "pickup_area", "destination", "departure_date", "departure_time", "route_flexibility", "pricing_type"];
    const offerFormRecord = offerForm as unknown as Record<string, string | number | undefined>;
    const missing = required.filter((k) => !offerFormRecord[k]);
    if (missing.length) {
      toast.error(`Please complete: ${missing.map((m) => m.replace(/_/g, " ")).join(", ")}`);
      return;
    }

    const capacity = Number(offerForm.vehicle_capacity_kg || driverProfile.vehicle_capacity_kg || 0);
    const remaining = Number(offerForm.remaining_capacity || capacity);

    setSavingOffer(true);
    try {
      await publishOffer({
        ...offerForm,
        vehicle_capacity_kg: capacity,
        remaining_capacity: remaining,
      });
      toast.success("Transport offer published");
      setEditingOffer(false);
    } catch (err) {
      toast.error(err.message || "Failed to publish offer");
    } finally {
      setSavingOffer(false);
    }
  };

  const handlePauseOffer = async () => {
    try {
      await pauseOffer();
      toast.info("Transport offer paused");
    } catch (err) {
      toast.error(err.message || "Failed to pause offer");
    }
  };

  const handleRemoveOffer = async () => {
    try {
      await removeOffer();
      toast.info("Transport offer removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove offer");
    }
  };

  const handleRespond = async (request: TransportRequest, action: "accept" | "decline") => {
    try {
      await respondToRequest(request.id, action);
      toast.success(`Request ${action === "accept" ? "accepted" : "declined"}`);
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const openCounter = (request: TransportRequest) => {
    setCounterDialog(request);
    setCounterPrice(request.driver_counter_price ? String(request.driver_counter_price) : "");
    setCounterNote(request.counter_note || "");
  };

  const submitCounter = async () => {
    if (!counterDialog) return;
    const price = Number(counterPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid counter price");
      return;
    }
    try {
      await respondToRequest(counterDialog.id, "counter", {
        counter_price: price,
        counter_note: counterNote,
      });
      toast.success("Counter offer sent");
      setCounterDialog(null);
    } catch (err) {
      toast.error(err.message || "Failed to send counter");
    }
  };

  const nextStatus = (current?: DeliveryJob["status"]) => {
    const idx = DELIVERY_STATUSES.indexOf(current || "Assigned");
    return DELIVERY_STATUSES[Math.min(idx + 1, DELIVERY_STATUSES.length - 1)];
  };

  const advanceJob = (job: DeliveryJob) => {
    setStatusDialog(job);
    setSelectedStatus(nextStatus(job.status));
  };

  const confirmStatusUpdate = async () => {
    if (!statusDialog) return;
    try {
      await updateDeliveryJobStatus(statusDialog.id, selectedStatus);
      toast.success(`Delivery status updated to ${selectedStatus}`);
      setStatusDialog(null);
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const confirmCancel = async () => {
    if (!cancelDialog) return;
    try {
      await handleCancelTrip(cancelDialog.id);
      toast.info("Trip cancelled");
      setCancelDialog(null);
    } catch (err) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  const handleAvailability = async (value: string) => {
    try {
      await toggleAvailability(value as AvailabilityStatus);
      toast.success(`Availability set to ${value}`);
    } catch (err) {
      toast.error(err.message || "Failed to update availability");
    }
  };

  const renderOfferForm = () => (
    <form onSubmit={handlePublishOffer} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driver Photo URL</Label>
          <Input placeholder="https://example.com/photo.jpg" value={offerForm.driver_photo_url || ""} onChange={(e) => setField("driver_photo_url", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Vehicle Type</Label>
          <Input value={offerForm.vehicle_type || driverProfile.vehicle_type || ""} onChange={(e) => setField("vehicle_type", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Vehicle Registration</Label>
          <Input value={offerForm.plate_number || driverProfile.plate_number || ""} onChange={(e) => setField("plate_number", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Maximum Capacity (kg)</Label>
          <Input type="number" value={offerForm.vehicle_capacity_kg || driverProfile.vehicle_capacity_kg || ""} onChange={(e) => setField("vehicle_capacity_kg", Number(e.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label>Remaining Capacity (kg)</Label>
          <Input type="number" value={offerForm.remaining_capacity ?? driverProfile.remaining_capacity ?? offerForm.vehicle_capacity_kg ?? driverProfile.vehicle_capacity_kg ?? ""} onChange={(e) => setField("remaining_capacity", Number(e.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label>Current Location</Label>
          <Input placeholder="e.g. Accra" value={offerForm.current_location_text || ""} onChange={(e) => setField("current_location_text", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Pickup Area</Label>
          <Input placeholder="e.g. Achimota Market" value={offerForm.pickup_area || ""} onChange={(e) => setField("pickup_area", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Destination</Label>
          <Input placeholder="e.g. Kumasi" value={offerForm.destination || ""} onChange={(e) => setField("destination", e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Planned Route</Label>
        <Textarea placeholder="Accra → Nsawam → Kumasi" value={offerForm.planned_route || ""} onChange={(e) => setField("planned_route", e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Departure Date</Label>
          <Input type="date" value={offerForm.departure_date || ""} onChange={(e) => setField("departure_date", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Departure Time</Label>
          <Input type="time" value={offerForm.departure_time || ""} onChange={(e) => setField("departure_time", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Estimated Arrival</Label>
          <Input placeholder="e.g. 18:00" value={offerForm.estimated_arrival || ""} onChange={(e) => setField("estimated_arrival", e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Route Flexibility</Label>
          <Select value={offerForm.route_flexibility || ""} onValueChange={(v) => setField("route_flexibility", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{ROUTE_FLEXIBILITY.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={offerForm.pricing_type || "Negotiable"} onValueChange={(v) => setField("pricing_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRICING_TYPE.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Suggested Fee (optional)</Label>
          <Input type="number" placeholder="GHS" value={offerForm.suggested_fee || ""} onChange={(e) => setField("suggested_fee", Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vehicle Features</Label>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_FEATURES.map((feature) => {
            const selected = ((offerForm.vehicle_features as string[]) || []).includes(feature);
            return (
              <Button
                key={feature}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArray("vehicle_features", feature, VEHICLE_FEATURES)}
              >
                {feature}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cargo Types Accepted</Label>
        <div className="flex flex-wrap gap-2">
          {CARGO_TYPES.map((cargo) => {
            const selected = ((offerForm.cargo_types_accepted as string[]) || []).includes(cargo);
            return (
              <Button
                key={cargo}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArray("cargo_types_accepted", cargo, CARGO_TYPES)}
              >
                {cargo}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Availability</Label>
          <Select value={driverProfile.availability_status || "online"} onValueChange={handleAvailability}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{AVAILABILITY.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Remaining Capacity Override</Label>
          <Input type="number" value={offerForm.remaining_capacity ?? driverProfile.remaining_capacity ?? ""} onChange={(e) => setField("remaining_capacity", Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Additional Information / Special Cargo Instructions</Label>
        <Textarea value={offerForm.offer_notes || ""} onChange={(e) => setField("offer_notes", e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={savingOffer}>
          {savingOffer ? "Saving…" : published ? "Update Transport Offer" : "Publish Transport Offer"}
        </Button>
        {published && (
          <>
            <Button type="button" variant="outline" onClick={handlePauseOffer}><Pause className="h-4 w-4 mr-1" /> Pause</Button>
            <Button type="button" variant="destructive" onClick={handleRemoveOffer}><X className="h-4 w-4 mr-1" /> Remove</Button>
          </>
        )}
      </div>
    </form>
  );

  const renderOfferSummary = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Published Transport Offer
            </CardTitle>
            <CardDescription>{driverProfile.current_location_text} → {driverProfile.destination}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingOffer(true)}><Settings className="h-4 w-4 mr-1" /> Update</Button>
            <Button variant="outline" size="sm" onClick={handlePauseOffer}><Pause className="h-4 w-4 mr-1" /> Pause</Button>
            <Button variant="destructive" size="sm" onClick={handleRemoveOffer}><X className="h-4 w-4 mr-1" /> Remove</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-[11px] text-muted-foreground uppercase">Vehicle</div><div>{driverProfile.vehicle_type}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Plate</div><div>{driverProfile.plate_number}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Capacity</div><div>{driverProfile.vehicle_capacity_kg} kg</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Remaining</div><div>{driverProfile.remaining_capacity} kg</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Route</div><div>{driverProfile.planned_route}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Departure</div><div>{driverProfile.departure_date} {driverProfile.departure_time}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">ETA</div><div>{driverProfile.estimated_arrival}</div></div>
          <div><div className="text-[11px] text-muted-foreground uppercase">Pricing</div><div>{driverProfile.pricing_type}</div></div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground uppercase">Vehicle Features</div>
          <div className="flex flex-wrap gap-1">{(driverProfile.vehicle_features || []).map((f) => <Badge key={f} variant="outline">{f}</Badge>)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground uppercase">Cargo Accepted</div>
          <div className="flex flex-wrap gap-1">{(driverProfile.cargo_types_accepted || []).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
        </div>
      </CardContent>
    </Card>
  );

  const renderRequests = () => (
    <div className="space-y-4">
      {myRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No transport requests yet.</p>
      ) : (
        myRequests.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base flex justify-between">
                <span className="flex items-center gap-2"><Package className="h-4 w-4" /> {r.product_type}</span>
                {statusBadge(r.negotiation_status || r.status)}
              </CardTitle>
              <CardDescription>{r.pickup_location} → {r.delivery_location}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-[11px] text-muted-foreground uppercase">Quantity</div><div>{r.quantity} {r.unit}</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Weight</div><div>{r.cargo_weight || "N/A"} kg</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Supplier Offer</div><div>{r.supplier_offer_price ? `${r.supplier_offer_price} GHS` : "Negotiable"}</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Driver Counter</div><div>{r.driver_counter_price ? `${r.driver_counter_price} GHS` : "—"}</div></div>
              </div>
              {(r.negotiation_status === "pending" || r.negotiation_status === "counter_supplier") && r.status !== "accepted" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleRespond(r, "accept")}><CheckCircle2 className="h-4 w-4 mr-1" /> Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => openCounter(r)}><DollarSign className="h-4 w-4 mr-1" /> Counter Offer</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRespond(r, "decline")}><X className="h-4 w-4 mr-1" /> Decline</Button>
                </div>
              )}
              {r.negotiation_status === "counter" && (
                <p className="text-sm text-muted-foreground">Counter offer sent. Waiting for supplier response.</p>
              )}
              {r.status === "accepted" && (
                <Button size="sm" variant="outline" onClick={() => navigate(`/agtrans-partner/trip/${r.id}`)}><Navigation className="h-4 w-4 mr-1" /> View Trip</Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderActive = () => (
    <div className="space-y-4">
      {myActiveJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No active deliveries.</p>
      ) : (
        myActiveJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <CardTitle className="text-base flex justify-between">
                <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> {job.product}</span>
                {statusBadge(job.status)}
              </CardTitle>
              <CardDescription>{job.pickup_location} → {job.destination}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-[11px] text-muted-foreground uppercase">Quantity</div><div>{job.quantity}</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Vehicle</div><div>{job.vehicle_type}</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Plate</div><div>{job.plate_number}</div></div>
                <div><div className="text-[11px] text-muted-foreground uppercase">Fee</div><div>{job.transport_fee ? `${job.transport_fee} GHS` : "—"}</div></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => advanceJob(job)}><RotateCcw className="h-4 w-4 mr-1" /> Update Status</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/agtrans-partner/trip/${job.id}`)}><Map className="h-4 w-4 mr-1" /> Trip Console</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/live-tracking/${job.id}`)}><Eye className="h-4 w-4 mr-1" /> Live Tracking</Button>
                <Button size="sm" variant="destructive" onClick={() => setCancelDialog(job)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myCompletedJobs.length === 0 && myCancelledJobs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 col-span-full">No trip history yet.</p>
        )}
        {myCompletedJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> {job.product}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>{job.pickup_location} → {job.destination}</div>
              <div>Fee: {job.transport_fee ? `${job.transport_fee} GHS` : "—"}</div>
              <div>Status: {job.status}</div>
            </CardContent>
          </Card>
        ))}
        {myCancelledJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><X className="h-4 w-4 text-red-500" /> {job.product}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>{job.pickup_location} → {job.destination}</div>
              <div>Status: Cancelled</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const changeTab = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    setActiveTab(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Driver Hub</h1>
          <p className="text-sm text-muted-foreground">Manage your transport offers, requests, and deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rating:</span>
          <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" /> {Number(driverProfile.driver_rating || 0).toFixed(1)} ({driverProfile.rating_count || 0})</Badge>
          <Badge variant={driverProfile.availability_status === "online" ? "default" : "secondary"}>{driverProfile.availability_status || "offline"}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="offer"><Truck className="h-4 w-4 mr-1" /> My Offer</TabsTrigger>
          <TabsTrigger value="requests"><ClipboardList className="h-4 w-4 mr-1" /> Requests</TabsTrigger>
          <TabsTrigger value="active"><Navigation className="h-4 w-4 mr-1" /> Active</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="offer" className="space-y-4">
          {published && !editingOffer ? renderOfferSummary() : renderOfferForm()}
          {published && !editingOffer && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingOffer(true)}>Edit Offer</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">{renderRequests()}</TabsContent>

        <TabsContent value="active">{renderActive()}</TabsContent>

        <TabsContent value="history">{renderHistory()}</TabsContent>
      </Tabs>

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
            <Button onClick={submitCounter}>Send Counter Offer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Delivery Status</DialogTitle></DialogHeader>
          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as DeliveryJob["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DELIVERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button onClick={confirmStatusUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Trip</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this trip? Frequent cancellations affect your reliability score.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Keep Trip</Button>
            <Button variant="destructive" onClick={confirmCancel}>Cancel Trip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
