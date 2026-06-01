import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAGTrans, TransportRequest } from "@/hooks/useAGTrans";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MapPin, Package, Clock, Bot, Bell } from "lucide-react";
import { toast } from "sonner";

export default function DriverDashboard() {
  const { user } = useAuth();
  const { requests, driverProfile, loading, updateRequestStatus, toggleAvailability } = useAGTrans();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !driverProfile) {
      navigate("/agtrans-partner/onboarding");
    }
  }, [driverProfile, loading, navigate]);

  if (loading) return <div>Loading...</div>;
  if (!driverProfile) return null;

  const availableRequests = requests.filter(r => r.status === "pending");
  const myActiveTrips = requests.filter(r => r.driver_id === user?.id && r.status === "in_transit");
  const myCompletedTrips = requests.filter(r => r.driver_id === user?.id && r.status === "delivered");

  const handleAccept = async (id: string) => {
    try {
      await updateRequestStatus(id, "in_transit", user?.id);
      toast.success("Request accepted! Routing you to the pickup location.");
      navigate(`/agtrans-partner/trip/${id}`);
    } catch (err: any) {
      toast.error("Failed to accept request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Driver Dashboard
            <Badge variant={driverProfile.verification_status === "verified" ? "default" : "secondary"}>
              {driverProfile.verification_status.toUpperCase()}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {driverProfile.full_name || "Partner"}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card p-2 px-4 rounded-lg border">
          <span className="text-sm font-medium">Availability</span>
          <Switch 
            checked={driverProfile.availability_status === "online"}
            onCheckedChange={(c) => toggleAvailability(c ? "online" : "offline")}
            disabled={driverProfile.verification_status !== "verified"}
          />
          <Badge variant={driverProfile.availability_status === "online" ? "default" : "secondary"} className="uppercase text-[10px]">
            {driverProfile.availability_status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-1">Active Trips</p>
            <p className="text-3xl font-bold">{myActiveTrips.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-1">Completed Trips</p>
            <p className="text-3xl font-bold">{myCompletedTrips.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-1">Driver Rating</p>
            <p className="text-3xl font-bold text-primary">{driverProfile.rating ? driverProfile.rating.toFixed(1) : "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {myActiveTrips.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Current Trips</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {myActiveTrips.map(trip => (
              <Card key={trip.id} className="border-primary bg-primary/5">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{trip.cargo_type}</h3>
                      <p className="text-sm text-muted-foreground">{trip.quantity} {trip.unit}</p>
                    </div>
                    <Badge>In Transit</Badge>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> From: {trip.pickup_location}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary"/> To: {trip.dropoff_location}</div>
                  </div>
                  <Button onClick={() => navigate(`/agtrans-partner/trip/${trip.id}`)} className="w-full mt-2">
                    Open Trip Workspace
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Requests</h2>
        {availableRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No new requests in your area.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {availableRequests.map(req => (
              <Card key={req.id}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{req.cargo_type}</h3>
                      <p className="text-sm text-muted-foreground">{req.quantity} {req.unit}</p>
                    </div>
                    <p className="font-bold text-lg text-primary">
                      GHS {req.price_offer?.toLocaleString() || "Negotiable"}
                    </p>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> Pickup: {req.pickup_location}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> Dropoff: {req.dropoff_location}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" /> Posted {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAccept(req.id)}
                    disabled={driverProfile.verification_status !== "verified"}
                  >
                    Accept & Route
                  </Button>
                  {driverProfile.verification_status !== "verified" && (
                    <p className="text-xs text-center text-red-500">Account pending verification</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-md text-sm border-l-2 border-primary">
                  <p className="font-semibold text-primary">System Notice</p>
                  <p className="text-muted-foreground mt-1 text-xs">Maintain high reliability to receive Layer 1 priority alerts for new delivery requests in your district.</p>
                </div>
                {availableRequests.length > 0 && (
                  <div className="p-3 bg-primary/10 rounded-md text-sm">
                    <p className="font-semibold">New Logistics Request</p>
                    <p className="text-muted-foreground mt-1 text-xs">There are {availableRequests.length} new transport requests in your operational zone.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
