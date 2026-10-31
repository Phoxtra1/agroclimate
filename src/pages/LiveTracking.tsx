import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAGTrans, DeliveryJob } from "@/hooks/useAGTrans";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Truck, MapPin, Navigation, Clock, Route, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";
interface TrackingEvent {
  id: string;
  delivery_job_id: string;
  event_type: string;
  event_description?: string;
  created_at: string;
}

const STATUS_PROGRESS: Record<string, number> = {
  Assigned: 5,
  "Driver En Route": 15,
  Loading: 25,
  "Picked Up": 40,
  "In Transit": 60,
  "Near Delivery": 80,
  Delivered: 95,
  Completed: 100,
};

export default function LiveTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deliveryJobs, trackingSessions, updateDeliveryJobStatus } = useAGTrans();
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);

  const job = useMemo(() => {
    if (!id) return undefined;
    return deliveryJobs.find((j) => j.id === id || j.request_id === id) as DeliveryJob | undefined;
  }, [deliveryJobs, id]);

  const session = useMemo(() => {
    if (!job) return null;
    return trackingSessions.find((s) => s.delivery_job_id === job.id) || null;
  }, [job, trackingSessions]);

  useEffect(() => {
    if (!job) return;
    const loadEvents = async () => {
      const { data } = await supabase
        .from("agtrans_tracking_events" as any)
        .select("*")
        .eq("delivery_job_id", job.id)
        .order("created_at", { ascending: true });
      setEvents((data as unknown as TrackingEvent[]) || []);
    };
    loadEvents();
    const ch = supabase
      .channel(`live-tracking-${job.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agtrans_tracking_events", filter: `delivery_job_id=eq.${job.id}` }, (payload: { new: TrackingEvent }) => {
        setEvents((prev) => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [job]);

  const progress = STATUS_PROGRESS[job?.status || "Assigned"] || 0;

  const confirmDelivery = async () => {
    if (!job) return;
    try {
      await updateDeliveryJobStatus(job.id, "Completed");
      setBuyerConfirmed(true);
      toast.success("Delivery confirmed. Thank you!");
      navigate(-1);
    } catch (err) {
      toast.error(err.message || "Failed to confirm delivery");
    }
  };

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-bold mt-4">Tracking not available</h2>
        <p className="text-sm text-muted-foreground">No active delivery matches this reference.</p>
      </div>
    );
  }

  const isBuyer = user?.id === job.buyer_id;
  const isDriver = user?.id === job.driver_id;
  const isSupplier = user?.id === job.supplier_id;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Navigation className="h-6 w-6 text-primary" /> Live Tracking</h1>
          <p className="text-sm text-muted-foreground">{job.product} · {job.quantity} · {job.pickup_location} → {job.destination}</p>
        </div>
        <Badge variant={job.status === "Completed" ? "default" : "secondary"}>{job.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Shared Satellite Tracking Map</CardTitle>
            <p className="text-sm text-muted-foreground">AgroClimate Satellite is the common map workspace for delivery coordinates, pickup and destination inspection.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {session?.current_lat != null && session?.current_lon != null ? (
              <OpenInSatelliteButton lat={session.current_lat} lon={session.current_lon} label="Current recorded vehicle position" zoom={17}>View current recorded vehicle position</OpenInSatelliteButton>
            ) : (
              <span className="text-sm text-muted-foreground">No current vehicle coordinates have been recorded yet.</span>
            )}
            {job.pickup_location && <OpenInSatelliteButton query={job.pickup_location} label="Delivery pickup" zoom={16}>View pickup</OpenInSatelliteButton>}
            {job.destination && <OpenInSatelliteButton query={job.destination} label="Delivery destination" zoom={16}>View destination</OpenInSatelliteButton>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Driver & Vehicle</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Driver</span><div className="font-semibold">{session?.driver_name || job.driver_name}</div></div>
              <div><span className="text-muted-foreground">Vehicle</span><div>{job.vehicle_type}</div></div>
              <div><span className="text-muted-foreground">Plate</span><div>{job.plate_number}</div></div>
              <div><span className="text-muted-foreground">Speed</span><div>{session?.speed_kn || 0} km/h</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Delivery Progress</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-2" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">ETA</span><div className="font-semibold text-primary">{session?.eta || "Calculating…"}</div></div>
                <div><span className="text-muted-foreground">Distance left</span><div className="font-semibold">{session?.distance_m ? `${Math.round(session.distance_m / 1000)} km` : "Pending…"}</div></div>
              </div>
              {isBuyer && job.status === "Delivered" && !buyerConfirmed && (
                <Button className="w-full" onClick={confirmDelivery}><CheckCircle2 className="h-4 w-4 mr-1" /> Confirm Delivery</Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4" /> Delivery Timeline</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracking events yet.</p>
          ) : (
            <div className="relative border-l-2 border-muted pl-4 space-y-4">
              {events.map((e) => (
                <div key={e.id} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{e.event_type}</div>
                  <div className="text-xs text-muted-foreground">{e.event_description}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
