import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAGTrans, TransportRequest, DeliveryJob, TrackingSession } from "@/hooks/useAGTrans";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Activity, Truck, Calendar, DollarSign, FileText, Bell, Clock, ShieldAlert,
  MapPin, CheckCircle, AlertTriangle, Star, Award, Navigation, Play, Square,
  Check, X, FileUp, ShieldCheck, Map, Eye, HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function DriverDashboard() {
  const { user } = useAuth();
  const {
    requests,
    deliveryJobs,
    trackingSessions,
    driverProfile,
    loading,
    updateDriverProfile,
    toggleAvailability,
    createDeliveryJob,
    updateDeliveryJobStatus,
    updateTrackingSessionLocation,
    handleCancelTrip,
  } = useAGTrans();

  const navigate = useNavigate();

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<
    "overview" | "vehicle" | "availability" | "requests" | "active" | "history" | "earnings" | "documents" | "notifications"
  >("overview");

  // Dialog states
  const [requestToAccept, setRequestToAccept] = useState<TransportRequest | null>(null);
  const [jobToCancel, setJobToCancel] = useState<DeliveryJob | null>(null);
  const [acceptingRulesWarning, setAcceptingRulesWarning] = useState(false);
  const [cancellingRulesWarning, setCancellingRulesWarning] = useState(false);

  // Form states for profile and vehicle
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [insuranceStatus, setInsuranceStatus] = useState("active");
  const [roadworthinessStatus, setRoadworthinessStatus] = useState("active");
  const [serviceArea, setServiceArea] = useState("");
  const [cargoCategories, setCargoCategories] = useState("");
  const [rateInformation, setRateInformation] = useState("");
  const [currentLat, setCurrentLat] = useState("5.6037");
  const [currentLon, setCurrentLon] = useState("-0.1870");

  // GPS Simulation state
  const [simulatingJobId, setSimulatingJobId] = useState<string | null>(null);
  const [simProgress, setSimProgress] = useState(0);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const routePointsRef = useRef<[number, number][]>([]);

  // Init form states from profile
  useEffect(() => {
    if (driverProfile) {
      setFullName(driverProfile.full_name || "");
      setPhone(driverProfile.phone || "");
      setVehicleType(driverProfile.vehicle_type || "");
      setPlateNumber(driverProfile.plate_number || "");
      setCapacity(String(driverProfile.vehicle_capacity_kg || ""));
      setInsuranceStatus(driverProfile.insurance_status || "active");
      setRoadworthinessStatus(driverProfile.roadworthiness_status || "active");
      setServiceArea(driverProfile.preferred_corridors?.join(", ") || "");
      setCargoCategories(driverProfile.cargo_categories?.join(", ") || "");
      setRateInformation(driverProfile.rate_information || "Negotiable");
      if (driverProfile.current_location) {
        setCurrentLat(String(driverProfile.current_location.lat));
        setCurrentLon(String(driverProfile.current_location.lon));
      }
    }
  }, [driverProfile]);

  // Redirect to onboarding if profile does not exist
  useEffect(() => {
    if (!loading && !driverProfile) {
      navigate("/agtrans-partner/onboarding");
    }
  }, [driverProfile, loading, navigate]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted-foreground">Loading AGTrans Partner dashboard…</div>;
  if (!driverProfile) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-6">
      <ShieldAlert className="h-10 w-10 text-primary" />
      <h2 className="text-xl font-bold">Complete driver onboarding to continue</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        We couldn't find your AGTrans driver profile. Finish onboarding to unlock the Driver Hub, receive delivery requests, and go online.
      </p>
      <Button onClick={() => navigate("/agtrans-partner/onboarding")}>Start Onboarding</Button>
    </div>
  );

  // Filter lists
  const availableRequests = requests.filter(r => r.status === "searching_driver" || (r.driver_id === user?.id && r.status === "Pending"));
  const myActiveJobs = deliveryJobs.filter(j => j.driver_id === user?.id && j.status !== "Delivered" && j.status !== "Cancelled");
  const myCompletedJobs = deliveryJobs.filter(j => j.driver_id === user?.id && j.status === "Delivered");
  const myHistoryJobs = deliveryJobs.filter(j => j.driver_id === user?.id);

  // Handle vehicle records save
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDriverProfile({
        vehicle_type: vehicleType,
        plate_number: plateNumber,
        vehicle_capacity_kg: Number(capacity) || 0,
        insurance_status: insuranceStatus,
        roadworthiness_status: roadworthinessStatus,
        preferred_corridors: serviceArea.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast.success("Vehicle records updated successfully!");
    } catch (err) {
      toast.error("Failed to update vehicle records");
    }
  };

  // Handle availability records save
  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDriverProfile({
        cargo_categories: cargoCategories.split(",").map(s => s.trim()).filter(Boolean),
        rate_information: rateInformation,
        current_location: { lat: Number(currentLat), lon: Number(currentLon) }
      });
      toast.success("Availability and rates updated!");
    } catch (err) {
      toast.error("Failed to update availability");
    }
  };

  // Handle Request Accept Action
  const triggerAcceptRequest = (req: TransportRequest) => {
    setRequestToAccept(req);
    setAcceptingRulesWarning(true);
  };

  const confirmAcceptRequest = async () => {
    if (!requestToAccept) return;
    setAcceptingRulesWarning(false);
    try {
      await createDeliveryJob(requestToAccept);
      toast.success("Delivery Job accepted successfully! Tracking session initialized.");
      setActiveTab("active");
    } catch (err) {
      toast.error("Failed to accept transport request");
    }
  };

  // Handle Decline Request Action
  const handleDeclineRequest = async (reqId: string) => {
    try {
      // Revert request status back so others can choose
      await supabase.from("agtrans_requests").update({ status: "searching_driver", driver_id: null }).eq("id", reqId);
      toast.info("Request declined. Removed from workspace.");
    } catch (err) {
      toast.error("Error declining request");
    }
  };

  // Handle Cancel Active Job Action
  const triggerCancelJob = (job: DeliveryJob) => {
    setJobToCancel(job);
    setCancellingRulesWarning(true);
  };

  const confirmCancelJob = async () => {
    if (!jobToCancel) return;
    setCancellingRulesWarning(false);
    try {
      stopGpsSimulation();
      await handleCancelTrip(jobToCancel.id);
      toast.error("Delivery cancelled. Standard penalties applied.");
      setJobToCancel(null);
    } catch (err) {
      toast.error("Error cancelling job");
    }
  };

  // Start GPS Simulation along mock road coordinate path
  const startGpsSimulation = async (job: DeliveryJob) => {
    if (simulatingJobId === job.id) return;
    toast.success("GPS Navigation active. Simulating cargo route...");
    setSimulatingJobId(job.id);
    setSimProgress(0);

    // Update job status to 'In Transit'
    await updateDeliveryJobStatus(job.id, "In Transit");

    // Generate mock route coordinates (Accra to Kumasi style points)
    const pickupLat = 5.6037;
    const pickupLon = -0.1870;
    const destLat = 6.6961;
    const destLon = -1.6152;

    const points: [number, number][] = [];
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      points.push([
        pickupLat + (destLat - pickupLat) * ratio + Math.sin(ratio * Math.PI) * 0.1,
        pickupLon + (destLon - pickupLon) * ratio + Math.cos(ratio * Math.PI) * 0.1
      ]);
    }
    routePointsRef.current = points;

    let idx = 0;
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(async () => {
      if (idx >= points.length) {
        clearInterval(simIntervalRef.current!);
        setSimulatingJobId(null);
        // Arrived! Transition status to Near Destination
        await updateDeliveryJobStatus(job.id, "Near Destination");
        toast.info("Vessel arrived near dropoff location!");
        return;
      }

      const [lat, lon] = points[idx];
      const bearing = idx > 0 
        ? Math.round((Math.atan2(lon - points[idx-1][1], lat - points[idx-1][0]) * 180) / Math.PI)
        : 45;

      const progress = Math.round((idx / (points.length - 1)) * 100);
      setSimProgress(progress);

      // Push real-time tracking packet
      await updateTrackingSessionLocation(job.id, {
        lat,
        lon,
        speed_kn: 32 + Math.floor(Math.random() * 8), // 35 knots / 60kmh mock speed
        heading: (bearing + 360) % 360,
        eta: progress === 100 ? "Arrived" : `${Math.round((1 - ratio(idx, points.length)) * 45)} mins`,
        distance_m: Math.round((1 - ratio(idx, points.length)) * 250000), // 250km mock distance
        route: points,
      });

      idx++;
    }, 3000);
  };

  const ratio = (current: number, total: number) => current / (total - 1 || 1);

  const stopGpsSimulation = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setSimulatingJobId(null);
  };

  // Clean simulation on unmount
  useEffect(() => {
    return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/40">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Driver Hub
            </h1>
            <Badge variant={driverProfile.verification_status === "verified" ? "default" : "secondary"} className="uppercase font-bold tracking-wide">
              {driverProfile.verification_status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {driverProfile.full_name || "Logistics Partner"} · Plate: {driverProfile.plate_number}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-card p-3 px-5 rounded-2xl border shadow-sm transition-all hover:shadow-md">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Duty Status</span>
            <span className="text-sm font-semibold capitalize">{driverProfile.availability_status}</span>
          </div>
          <Switch 
            checked={driverProfile.availability_status === "online"}
            onCheckedChange={(c) => toggleAvailability(c ? "online" : "offline")}
            disabled={driverProfile.verification_status !== "verified"}
          />
        </div>
      </div>

      {/* Main dual panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2 lg:col-span-1">
          <Card className="border-border/60 bg-card/40 backdrop-blur-md sticky top-6">
            <CardContent className="p-3 space-y-1">
              {[
                { id: "overview", name: "Overview", icon: Activity },
                { id: "vehicle", name: "My Vehicle", icon: Truck },
                { id: "availability", name: "Availability & Rates", icon: MapPin },
                { id: "requests", name: "Delivery Requests", icon: Calendar, badge: availableRequests.length },
                { id: "active", name: "Active Trip Console", icon: Navigation, badge: myActiveJobs.length },
                { id: "history", name: "Job History", icon: Clock },
                { id: "earnings", name: "Earnings Ledger", icon: DollarSign },
                { id: "documents", name: "Credentials & Docs", icon: FileText },
                { id: "notifications", name: "System Alerts", icon: Bell, badge: driverProfile.verification_status === "suspended" ? 1 : 0 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <Badge variant={activeTab === tab.id ? "secondary" : "destructive"} className="h-5 min-w-5 flex items-center justify-center p-0 rounded-full text-xs">
                      {tab.badge}
                    </Badge>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tab content panel */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover:shadow-lg transition-all duration-300">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Reliability Rating</p>
                      <p className="text-2xl font-black text-primary">{Number(driverProfile.reliability_score ?? 100).toFixed(0)}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all duration-300">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Jobs Completed</p>
                      <p className="text-2xl font-black">{driverProfile.completed_deliveries || 0}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all duration-300">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Cancellations</p>
                      <p className="text-2xl font-black text-amber-600">{driverProfile.cancellations || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Warnings Banner */}
              {driverProfile.verification_status === "suspended" && (
                <Card className="border-l-4 border-destructive bg-destructive/5">
                  <CardContent className="p-4 flex gap-3">
                    <ShieldAlert className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-destructive">Account Suspended</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your account has been suspended for 30 days due to excess cancellations. You cannot accept requests or receive payout earnings until suspension expires.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active Jobs Quick View */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Shipments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myActiveJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active shipments. Switch availability on to receive requests.</p>
                  ) : (
                    myActiveJobs.map(job => (
                      <div key={job.id} className="border p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/10">
                        <div>
                          <p className="font-bold text-base">{job.product}</p>
                          <p className="text-xs text-muted-foreground">{job.quantity} units · {job.pickup_location} ➔ {job.destination}</p>
                          <div className="mt-2 flex gap-2">
                            <Badge>{job.status}</Badge>
                            {simulatingJobId === job.id && <Badge variant="secondary" className="animate-pulse">GPS Live Tracking</Badge>}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab("active")}>
                          Open Console
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: MY VEHICLE */}
          {activeTab === "vehicle" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vehicle Records & Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveVehicle} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Vehicle Type</Label>
                      <Select value={vehicleType} onValueChange={setVehicleType}>
                        <SelectTrigger><SelectValue placeholder="Select vehicle class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Truck">10-Ton Heavy Tipper Truck</SelectItem>
                          <SelectItem value="Pickup">4x4 Utility Pickup Truck</SelectItem>
                          <SelectItem value="Van">5-Ton Cargo Box Van</SelectItem>
                          <SelectItem value="Motorcycle">AgroDelivery Motorcycle</SelectItem>
                          <SelectItem value="Boat">Volta River Cargo Vessel (Boat)</SelectItem>
                          <SelectItem value="Canoe">Artisanal Cargo Canoe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Plate Number</Label>
                      <Input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Vehicle Cargo Capacity (kg)</Label>
                      <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Operational corridors / Service Area</Label>
                      <Input value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="e.g. Kumasi - Accra, Volta River Basin" />
                    </div>
                    <div className="space-y-2">
                      <Label>Insurance Record Status</Label>
                      <Select value={insuranceStatus} onValueChange={setInsuranceStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active & Verified (Gold Tier)</SelectItem>
                          <SelectItem value="pending">Review Pending Renewal</SelectItem>
                          <SelectItem value="expired">Expired (Requires Upload)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Roadworthiness sticker</Label>
                      <Select value={roadworthinessStatus} onValueChange={setRoadworthinessStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Certified Fit (Valid)</SelectItem>
                          <SelectItem value="expired">Expired (Action Required)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Vehicle Images</Label>
                    <div className="border border-dashed rounded-xl p-6 text-center hover:bg-muted/10 transition cursor-pointer flex flex-col items-center justify-center gap-2">
                      <FileUp className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload side, rear, and interior cabin photos. PNG/JPG up to 10MB.</span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Update Vehicle Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: WORK & AVAILABILITY */}
          {activeTab === "availability" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Work Capacity & Rate Card</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveAvailability} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Cargo Specialities (comma separated)</Label>
                      <Input value={cargoCategories} onChange={e => setCargoCategories(e.target.value)} placeholder="e.g. Cereals, Tuber Crops, Perishables" />
                    </div>
                    <div className="space-y-2">
                      <Label>Base Rate Structure</Label>
                      <Input value={rateInformation} onChange={e => setRateInformation(e.target.value)} placeholder="e.g. GHS 12 per km, GHS 500 flat rate" />
                    </div>
                    <div className="space-y-2">
                      <Label>Current Location Latitude</Label>
                      <Input type="number" step="any" value={currentLat} onChange={e => setCurrentLat(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Current Location Longitude</Label>
                      <Input type="number" step="any" value={currentLon} onChange={e => setCurrentLon(e.target.value)} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Save Availability Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: DELIVERY REQUESTS */}
          {activeTab === "requests" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Delivery Offers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending transport requests at the moment.</p>
                ) : (
                  availableRequests.map(req => (
                    <div key={req.id} className="border p-4 rounded-xl space-y-3 bg-muted/5">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">Direct Offer</Badge>
                          <h4 className="font-bold text-lg">{req.product_type}</h4>
                          <p className="text-xs text-muted-foreground">Qty: {req.quantity} {req.unit}</p>
                        </div>
                        <p className="font-black text-primary text-xl">GHS {req.estimated_price || "Negotiable"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-y py-2 border-border/40">
                        <div>
                          <span className="text-muted-foreground block uppercase font-bold tracking-wide text-[9px]">Pickup</span>
                          <span className="font-medium text-foreground">{req.pickup_location}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block uppercase font-bold tracking-wide text-[9px]">Dropoff</span>
                          <span className="font-medium text-foreground">{req.delivery_location}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeclineRequest(req.id)}
                        >
                          Decline
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => triggerAcceptRequest(req)}
                          disabled={driverProfile.verification_status !== "verified"}
                        >
                          Accept Cargo Offer
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 5: ACTIVE TRIP CONSOLE */}
          {activeTab === "active" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GPS Real-Time Tracking Console</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {myActiveJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No active shipments in transit.</p>
                ) : (
                  myActiveJobs.map(job => {
                    const session = trackingSessions.find(s => s.delivery_job_id === job.id);
                    return (
                      <div key={job.id} className="border p-5 rounded-2xl space-y-6 bg-card shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <h3 className="font-bold text-xl">{job.product}</h3>
                            <p className="text-xs text-muted-foreground">{job.quantity} units · Job ID: {job.id.substring(0, 8)}</p>
                            <div className="mt-2 flex gap-2">
                              <Badge className="bg-primary/95 text-primary-foreground">{job.status}</Badge>
                              {simulatingJobId === job.id && (
                                <Badge variant="secondary" className="animate-pulse bg-emerald-500/10 text-emerald-600">
                                  GPS Tracking Online
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {job.status === "Accepted" && (
                              <Button size="sm" onClick={() => updateDeliveryJobStatus(job.id, "Loading")}>
                                Mark Loading
                              </Button>
                            )}
                            {(job.status === "Accepted" || job.status === "Loading") && (
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => startGpsSimulation(job)}
                              >
                                <Play className="h-4 w-4 mr-2" /> Start Trip
                              </Button>
                            )}
                            {job.status === "In Transit" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={stopGpsSimulation}
                              >
                                Pause GPS
                              </Button>
                            )}
                            {(job.status === "In Transit" || job.status === "Near Destination") && (
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => updateDeliveryJobStatus(job.id, "Delivered")}
                              >
                                Mark Delivered
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => triggerCancelJob(job)}
                            >
                              Cancel Delivery
                            </Button>
                          </div>
                        </div>

                        {/* GPS Progress simulation view */}
                        {simulatingJobId === job.id && (
                          <div className="space-y-2 border-t pt-4 border-border/40">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Transit Progress</span>
                              <span>{simProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${simProgress}%` }} />
                            </div>
                            {session && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-xs">
                                <div className="p-3 bg-muted/30 rounded-xl">
                                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Speed</span>
                                  <span className="font-semibold text-sm">{session.speed_kn || 0} km/h</span>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-xl">
                                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Heading</span>
                                  <span className="font-semibold text-sm">{(session.heading || 0)}° NNE</span>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-xl">
                                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">ETA</span>
                                  <span className="font-semibold text-sm text-primary">{session.eta || "Calculating..."}</span>
                                </div>
                                <div className="p-3 bg-muted/30 rounded-xl">
                                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Remaining</span>
                                  <span className="font-semibold text-sm">{session.distance_m ? `${Math.round(session.distance_m / 1000)} km` : "Pending..."}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 6: JOB HISTORY */}
          {activeTab === "history" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Completed Delivery Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {myHistoryJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transport records in archive.</p>
                ) : (
                  myHistoryJobs.map(job => (
                    <div key={job.id} className="border p-4 rounded-xl flex justify-between items-center gap-4 bg-muted/5">
                      <div>
                        <h4 className="font-bold">{job.product}</h4>
                        <p className="text-xs text-muted-foreground">{job.quantity} units · {job.pickup_location} ➔ {job.destination}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Completed: {new Date(job.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={job.status === "Delivered" ? "default" : "destructive"}>
                        {job.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 7: EARNINGS */}
          {activeTab === "earnings" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Earnings Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Gross Completed Earnings</p>
                    <p className="text-3xl font-black text-emerald-600 mt-1">GHS {(myCompletedJobs.length * 850).toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Pending Payout</p>
                    <p className="text-3xl font-black text-blue-600 mt-1">GHS {(myActiveJobs.length * 850).toLocaleString()}</p>
                  </div>
                </div>

                <div className="border rounded-2xl p-5 space-y-4">
                  <h4 className="font-bold text-sm">Recent Ledger Statements</h4>
                  {myCompletedJobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No earnings entries posted yet.</p>
                  ) : (
                    myCompletedJobs.map(job => (
                      <div key={job.id} className="flex justify-between items-center text-xs py-2 border-b border-border/40 last:border-0">
                        <div>
                          <p className="font-semibold">Transport Payout · {job.product}</p>
                          <p className="text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="font-bold text-emerald-600">+ GHS 850.00</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 8: DOCUMENTS */}
          {activeTab === "documents" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Digital Document Vault</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { name: "Commercial Driver License (Class F)", desc: "Required for trucks and heavy cargo transport.", state: driverProfile.verification_status === "verified" ? "Verified" : "Pending Approval" },
                  { name: "National Roadworthiness Certification", desc: "Verifies vehicle chassis and brake efficiency.", state: roadworthinessStatus === "active" ? "Valid" : "Expired" },
                  { name: "Comprehensive Transit Cargo Insurance", desc: "Protects supplier assets against transit risks.", state: insuranceStatus === "active" ? "Valid" : "Expired" },
                ].map((doc, idx) => (
                  <div key={idx} className="border p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/10">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.desc}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={doc.state.includes("Verified") || doc.state === "Valid" ? "default" : "secondary"}>
                        {doc.state}
                      </Badge>
                      <Button size="icon" variant="outline" className="rounded-full">
                        <FileUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* TAB 9: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Audit & Policy Bulletins</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-500/10 text-amber-800 rounded-xl flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold">AGTrans Safety & Transit Policy</p>
                    <p className="text-muted-foreground mt-1 leading-relaxed">
                      Please remember that cancelling a delivery job after acceptance triggers a GHS 150 administrative fine and a -15 penalty to your reliability rating. Drivers with 3 or more active cancellations will face temporary account suspension.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl flex gap-3 text-xs">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold">Registration Verification Successful</p>
                    <p className="text-muted-foreground mt-0.5">Your core identity files have been successfully validated by AgroClimate Ops.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Rules warning when accepting a request */}
      <Dialog open={acceptingRulesWarning} onOpenChange={setAcceptingRulesWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Job Acceptance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>You are about to accept the delivery contract for <strong>{requestToAccept?.product_type}</strong> ({requestToAccept?.quantity} {requestToAccept?.unit}).</p>
            <div className="p-3 bg-amber-500/10 text-amber-800 border-l-2 border-amber-500 text-xs leading-relaxed rounded-md">
              <strong>WARNING:</strong> Under AgroClimate rule enforcement, once you accept this contract, a <strong>GHS 150 fine</strong> and <strong>15-point reliability penalty</strong> will apply if you cancel, or your account will be suspended for 30 days if you reach 3 cancellations.
            </div>
            <p className="text-xs text-muted-foreground">Do you agree to these transit terms and wish to lock in this assignment?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcceptingRulesWarning(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmAcceptRequest}>I Agree & Accept</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules warning when cancelling active job */}
      <Dialog open={cancellingRulesWarning} onOpenChange={setCancellingRulesWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> WARNING: Cancel Shipment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm font-medium">
            <p className="text-destructive">Are you absolutely sure you want to cancel this delivery contract?</p>
            <div className="p-4 bg-red-500/10 text-red-700 border-l-2 border-red-500 text-xs leading-relaxed rounded-md space-y-1">
              <p><strong>ADMINISTRATION PENALTIES WILL BE ENFORCED:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Automatic deduction of GHS 150.00 cancellation fee.</li>
                <li>Your reliability score will drop by 15 points.</li>
                <li>If your total cancellation count reaches 3 (current cancellations: {driverProfile.cancellations}), your driver profile will be suspended for 30 days.</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancellingRulesWarning(false)}>Keep Shipment</Button>
            <Button variant="destructive" onClick={confirmCancelJob}>Confirm Cancel & Pay Fine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
