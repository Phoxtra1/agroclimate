import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAGTrans } from "@/hooks/useAGTrans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, CheckCircle, AlertTriangle, Bot, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { requests, updateRequestStatus } = useAGTrans();
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const trip = requests.find(r => r.id === id);


  useEffect(() => {
    if (trip && trip.status === "in_transit") {
      // Simulate fetching AI route insight
      setAiInsight("Route optimized. Avoid N1 highway due to heavy traffic. Estimated time saved: 15 mins.");
    }
  }, [trip]);

  if (!trip) return <div className="p-6">Trip not found</div>;

  const handleComplete = async () => {
    try {
      await updateRequestStatus(trip.id, "delivered");
      toast.success("Delivery marked as completed!");
      navigate("/agtrans-partner/dashboard");
    } catch (err) {
      toast.error("Failed to complete delivery");
    }
  };

  const handleReportIssue = async () => {
    try {
      await updateRequestStatus(trip.id, "disputed");
      toast.error("Issue reported. Admin notified.");
    } catch (err) {
      toast.error("Failed to report issue");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Trip <Badge variant="outline">{trip.tracking_code || trip.id.substring(0,8)}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">Transporting {trip.quantity} {trip.unit} of {trip.product_type}</p>

        </div>
        <Badge variant={trip.status === "delivered" ? "default" : "secondary"} className="uppercase">
          {trip.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5" /> Route Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative pl-6 border-l-2 border-primary/30 space-y-8">
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                  <p className="text-xs font-semibold text-primary uppercase">Pickup</p>
                  <p className="font-medium text-lg">{trip.pickup_location}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full bg-primary" />
                  <p className="text-xs font-semibold text-primary uppercase">Dropoff</p>
                  <p className="font-medium text-lg">{trip.delivery_location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {aiInsight && (
            <Card className="border-blue-500 bg-blue-500/5">
              <CardContent className="p-4 flex gap-3">
                <Bot className="h-6 w-6 text-blue-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm text-blue-700">AI Route Advisor</h4>
                  <p className="text-sm text-blue-600/90">{aiInsight}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {trip.status === "in_transit" && (
            <div className="flex gap-4">
              <Button onClick={handleComplete} className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-lg">
                <CheckCircle className="mr-2 h-5 w-5" /> Mark Delivered
              </Button>
              <Button onClick={handleReportIssue} variant="destructive" className="h-12">
                <AlertTriangle className="mr-2 h-5 w-5" /> Report Issue
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cargo Manifest</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium">{trip.product_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-medium">{trip.quantity} {trip.unit}</p>
              </div>
              {trip.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Special Instructions</p>
                  <p className="text-sm">{trip.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Agreed Rate</p>
                <p className="font-medium text-primary">GHS {trip.estimated_price}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Supplier Contact</p>
                <p className="font-medium">Call for pickup</p>
              </div>
              <Button variant="outline" size="icon" className="rounded-full">
                <Phone className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
