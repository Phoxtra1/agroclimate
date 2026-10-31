import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAGTrans } from "@/hooks/useAGTrans";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Navigation, CheckCircle, AlertTriangle, Bot, Phone, Navigation2, Compass, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";


export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { requests, deliveryJobs, trackingSessions, updateDeliveryJobStatus, updateTrackingSessionLocation, handleCancelTrip } = useAGTrans();
  const { user } = useAuth();
  const [gpsSharing, setGpsSharing] = useState(false);
  const [gpsFix, setGpsFix] = useState<{ lat: number; lon: number; accuracyM: number; capturedAt: string } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsWriteAtRef = useRef(0);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);

  // Retrieve matching request, job and tracking session
  const trip = requests.find(r => r.id === id);
  const job = deliveryJobs.find(j => j.product === trip?.product_type && j.supplier_id === trip?.supplier_id);
  const session = job ? trackingSessions.find(s => s.delivery_job_id === job.id) : null;

  useEffect(() => {
    if (job && job.status === "In Transit") {
      setAiInsight("Route optimized. Standard Kumasi-Accra highway weather warning: Light rains near Koforidua. Maintain 50km/h.");
    } else {
      setAiInsight("Awaiting dispatch. Ready to calculate optimal corridors once trip starts.");
    }
  }, [job]);

  const stopGpsSharing = () => {
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setGpsSharing(false);
  };

  useEffect(() => () => {
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
    }
  }, []);

  const startGpsSharing = () => {
    if (!job || !user || user.id !== job.driver_id) {
      setGpsError("Only the assigned driver can share this trip's location.");
      return;
    }
    if (!navigator.geolocation) {
      setGpsError("This browser does not support device GPS.");
      return;
    }
    if (!navigator.onLine) {
      setGpsError("An internet connection is required to publish live trip GPS.");
      return;
    }

    setGpsError("");
    setGpsSharing(true);
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(async (position) => {
      const capturedAt = new Date(position.timestamp).toISOString();
      const accuracyM = position.coords.accuracy;
      setGpsFix({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracyM,
        capturedAt,
      });

      if (!Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > 100) {
        setGpsError("GPS accuracy is over 100 m. The current position is not being published until accuracy improves.");
        return;
      }
      if (Date.now() - lastGpsWriteAtRef.current < 15000) return;

      lastGpsWriteAtRef.current = Date.now();
      try {
        await updateTrackingSessionLocation(job.id, {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracyM,
          source: "device_gps",
          capturedAt,
          speed_kn: position.coords.speed == null ? undefined : Number((position.coords.speed * 3.6).toFixed(1)),
          heading: position.coords.heading ?? undefined,
        });
        setGpsError("");
      } catch (error) {
        setGpsError(error instanceof Error ? error.message : "Could not publish this GPS update.");
      }
    }, (error) => {
      setGpsError(error.message || "Device GPS permission or signal unavailable.");
      stopGpsSharing();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };

  if (!trip) return <div className="p-6">Trip not found</div>;

  const handleStartTrip = async () => {
    if (!job) return;
    try {
      await updateDeliveryJobStatus(job.id, "In Transit");
      toast.success("Trip status updated to In Transit.");
    } catch (err) {
      toast.error("Failed to start trip");
    }
  };

  const handleComplete = async () => {
    if (!job) return;
    try {
      await updateDeliveryJobStatus(job.id, "Delivered");
      toast.success("Delivery marked as completed!");
      navigate("/agtrans-partner/dashboard");
    } catch (err) {
      toast.error("Failed to complete delivery");
    }
  };

  const handleConfirmCancel = async () => {
    if (!job) return;
    try {
      await handleCancelTrip(job.id);
      toast.error("Trip cancelled. Penalty applied.");
      setShowCancelWarning(false);
      navigate("/agtrans-partner/dashboard");
    } catch (err) {
      toast.error("Failed to cancel trip");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Title HUD */}
      <div className="flex justify-between items-center border-b pb-4 border-border/40">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            Trip Console <Badge variant="outline">{trip.tracking_code || trip.id.substring(0,8)}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">Transporting {trip.quantity} {trip.unit} of {trip.product_type}</p>
        </div>
        <Badge variant={job?.status === "Delivered" ? "default" : job?.status === "In Transit" ? "secondary" : "outline"} className="uppercase font-bold tracking-wider px-3 py-1 text-xs">
          {job?.status || "Awaiting Setup"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column - Map and controls */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card className="overflow-hidden border-border/60 shadow-lg">
            <CardHeader className="bg-muted/10 py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Shared Satellite Navigation</CardTitle>
              <p className="text-xs text-muted-foreground">Open recorded pickup and delivery locations in the common AgroClimate Satellite workspace.</p>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">PICKUP / COLLECTION</div>
                <p className="text-sm font-medium">{trip.pickup_location || "Pickup location not recorded"}</p>
                {trip.pickup_location && <OpenInSatelliteButton query={trip.pickup_location} label="AG Trans pickup" zoom={16}>Inspect pickup</OpenInSatelliteButton>}
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">DELIVERY DESTINATION</div>
                <p className="text-sm font-medium">{trip.delivery_location || "Delivery destination not recorded"}</p>
                {trip.delivery_location && <OpenInSatelliteButton query={trip.delivery_location} label="AG Trans delivery destination" zoom={16}>Navigate to destination</OpenInSatelliteButton>}
              </div>
              <div className="sm:col-span-2 rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold">DRIVER DEVICE GPS</div>
                    <p className="text-[11px] text-muted-foreground">Location sharing is opt-in. Only the assigned driver can publish device GPS for this trip.</p>
                  </div>
                  {gpsSharing ? (
                    <Button size="sm" variant="destructive" onClick={stopGpsSharing}>Stop GPS sharing</Button>
                  ) : (
                    <Button size="sm" onClick={startGpsSharing} disabled={!user || user.id !== job?.driver_id || ["Delivered","Cancelled","Completed"].includes(job?.status || "")}>
                      Start GPS sharing
                    </Button>
                  )}
                </div>
                {gpsFix && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{gpsFix.lat.toFixed(6)}, {gpsFix.lon.toFixed(6)}</span>
                    <span>±{Math.round(gpsFix.accuracyM)} m</span>
                    <span>{new Date(gpsFix.capturedAt).toLocaleTimeString()}</span>
                    {gpsFix.accuracyM <= 100 && (
                      <OpenInSatelliteButton lat={gpsFix.lat} lon={gpsFix.lon} label="Last device GPS fix for this AG Trans trip" zoom={17}>
                        Inspect last GPS fix in Satellite
                      </OpenInSatelliteButton>
                    )}
                  </div>
                )}
                {gpsError && <p className="text-[10px] text-amber-700">{gpsError}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Telemetry Stats HUD */}
          {job?.status === "In Transit" && session && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="hover:shadow-md transition">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Navigation2 className="h-5 w-5 text-primary mb-1 rotate-45" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Velocity</span>
                  <span className="text-lg font-black mt-1">{session.speed_kn || 0} km/h</span>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Compass className="h-5 w-5 text-emerald-600 mb-1" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Heading</span>
                  <span className="text-lg font-black mt-1">{session.heading || 0}° N</span>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <Clock className="h-5 w-5 text-blue-500 mb-1" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Est. Duration</span>
                  <span className="text-lg font-black mt-1 text-primary">{session.eta || "Calculating..."}</span>
                </CardContent>
              </Card>
              <Card className="hover:shadow-md transition">
                <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                  <MapPin className="h-5 w-5 text-red-500 mb-1" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Distance left</span>
                  <span className="text-lg font-black mt-1">
                    {session.distance_m ? `${Math.round(session.distance_m / 1000)} km` : "Pending..."}
                  </span>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Advisor Panel */}
          {aiInsight && (
            <Card className="border-blue-500 bg-blue-500/5">
              <CardContent className="p-4 flex gap-3">
                <Bot className="h-6 w-6 text-blue-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm text-blue-700">AI Route Advisor</h4>
                  <p className="text-sm text-blue-600/90 mt-0.5">{aiInsight}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {job?.status === "Assigned" && (
              <Button onClick={handleStartTrip} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-lg">
                <Navigation className="mr-2 h-5 w-5" /> Start Trip
              </Button>
            )}
            {(job?.status === "In Transit" || job?.status === "Near Delivery") && (
              <Button onClick={handleComplete} className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg">
                <CheckCircle className="mr-2 h-5 w-5" /> Mark Delivered
              </Button>
            )}
            {job?.status !== "Delivered" && job?.status !== "Cancelled" && (
              <Button onClick={() => setShowCancelWarning(true)} variant="destructive" className="h-12 px-6">
                <AlertTriangle className="mr-2 h-5 w-5" /> Cancel Trip
              </Button>
            )}
          </div>
        </div>

        {/* Right column - Cargo manifests */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/5 py-4 border-b border-border/40">
              <CardTitle className="text-base font-bold">Cargo Manifest</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs text-muted-foreground uppercase font-bold">Product Category</span>
                <span className="font-semibold">{trip.product_type}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs text-muted-foreground uppercase font-bold">Load Weight</span>
                <span className="font-semibold">{trip.quantity} {trip.unit}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs text-muted-foreground uppercase font-bold">Transit Budget</span>
                <span className="font-semibold text-primary">GHS {trip.estimated_price}</span>
              </div>
              {trip.notes && (
                <div className="space-y-1 pt-2">
                  <span className="text-xs text-muted-foreground uppercase font-bold block">Special Instructions</span>
                  <p className="text-xs text-foreground bg-muted/30 p-3 rounded-xl border border-border/40 leading-relaxed">
                    {trip.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Supplier Contact</p>
                <p className="font-medium text-sm">Call for Pickup coordination</p>
              </div>
              <Button variant="outline" size="icon" className="rounded-full">
                <Phone className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rules warning when cancelling trip */}
      <Dialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Safety Policy Warning
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed">
            <p className="font-bold text-red-600">You are about to cancel this active shipment!</p>
            <p>Under AgroClimate logistics compliance rules, cancelling a shipment after accepting the order results in:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
              <li>A standard GHS 150 administrative fine.</li>
              <li>A -15 reduction in your driver reliability score.</li>
              <li>Potential 30-day driver account suspension.</li>
            </ul>
            <p className="text-xs font-semibold text-foreground">Do you accept the cancellation penalty and wish to abort this trip?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelWarning(false)}>Keep Trip</Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>Confirm Cancel & Pay Fine</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
