import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Truck, Navigation, AlertTriangle, ShieldCheck } from "lucide-react";
import { TransportRequest, DriverProfile } from "@/hooks/useAGTrans";

export default function AdminAGTransPanel() {
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [{ data: reqs }, { data: drvs }] = await Promise.all([
        supabase.from("transport_requests" as any).select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("agtrans_drivers" as any).select("*").order("user_id").limit(100)
      ]);
      setRequests((reqs as TransportRequest[]) || []);
      setDrivers((drvs as DriverProfile[]) || []);
    };
    
    loadData();

    const ch = supabase.channel("admin-agtrans")
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_requests" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleVerifyDriver = async (userId: string, status: "verified" | "rejected") => {
    const { error } = await supabase
      .from("agtrans_drivers" as any)
      .update({ verification_status: status })
      .eq("user_id", userId);
    if (error) toast.error("Failed to update verification");
    else toast.success("Driver verification updated");
  };

  const handleResolveDispute = async (reqId: string) => {
    const { error } = await supabase
      .from("transport_requests" as any)
      .update({ status: "pending" })
      .eq("id", reqId);
    if (error) toast.error("Failed to resolve dispute");
    else toast.success("Dispute resolved, request set to pending");
  };

  const pendingDrivers = drivers.filter(d => d.verification_status === "pending");
  const disputedRequests = requests.filter(r => r.status === "disputed");
  const liveTrips = requests.filter(r => r.status === "in_transit");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">AGTrans Control Center</h1>
          <p className="text-sm text-muted-foreground">Manage driver approvals, monitor live logistics, and handle disputes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-yellow-600" /> Pending Driver Approvals ({pendingDrivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingDrivers.length === 0 ? <p className="text-sm text-muted-foreground">No pending drivers.</p> : (
              pendingDrivers.map(d => (
                <div key={d.user_id} className="border p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{d.vehicle_type}</p>
                    <p className="text-xs text-muted-foreground">License: {d.license_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleVerifyDriver(d.user_id, "rejected")}>Reject</Button>
                    <Button size="sm" onClick={() => handleVerifyDriver(d.user_id, "verified")}>Verify</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Active Disputes ({disputedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {disputedRequests.length === 0 ? <p className="text-sm text-muted-foreground">No active disputes.</p> : (
              disputedRequests.map(r => (
                <div key={r.id} className="border p-3 rounded-lg border-destructive bg-destructive/5">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">Tracking: {r.tracking_id}</p>
                      <p className="text-xs">{r.cargo_type} - {r.quantity}{r.unit}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleResolveDispute(r.id)}>Resolve</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" /> Live Deliveries Tracking ({liveTrips.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveTrips.length === 0 ? <p className="text-sm text-muted-foreground">No active deliveries.</p> : (
                liveTrips.map(r => (
                  <div key={r.id} className="border p-3 rounded-lg relative overflow-hidden bg-card">
                    <div className="absolute top-0 right-0 p-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    </div>
                    <p className="font-semibold">{r.tracking_id}</p>
                    <p className="text-xs text-muted-foreground mb-2">{r.cargo_type} • {r.quantity}{r.unit}</p>
                    <div className="text-xs space-y-1">
                      <p>From: {r.pickup_location}</p>
                      <p>To: {r.dropoff_location}</p>
                      <p className="text-primary mt-2">Driver ID: {r.driver_id?.substring(0,8)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
