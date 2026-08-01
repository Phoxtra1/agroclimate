import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Navigation, AlertTriangle, ShieldCheck, User, FileText, CheckCircle2, XCircle, HelpCircle, PauseCircle, PlayCircle, Eye } from "lucide-react";
import { useAGTrans, DriverProfile, DeliveryJob, TransportRequest, TransportAgreement } from "@/hooks/useAGTrans";
import type { ApprovalStatus } from "@/hooks/useTransport";

interface NotificationDoc {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export default function AdminAGTransPanel() {
  const { drivers, requests, deliveryJobs, trackingSessions } = useAGTrans();
  const [agreements, setAgreements] = useState<TransportAgreement[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<TransportAgreement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("transport_agreements")
        .select("*")
        .order("agreement_timestamp", { ascending: false })
        .limit(200);
      setAgreements((data as unknown as TransportAgreement[]) || []);
    };
    load();
    const ch = supabase
      .channel("admin-transport-agreements")
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_agreements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setApproval = async (driver: DriverProfile, status: ApprovalStatus, reason?: string) => {
    const patch: Partial<DriverProfile> = { approval_status: status };
    if (status === "approved") {
      patch.verification_status = "verified";
      patch.admin_suspended = false;
    } else if (status === "rejected") {
      patch.rejection_reason = reason || "Application does not meet requirements";
    } else if (status === "more_info") {
      patch.rejection_reason = reason || "Additional information required";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("agtrans_drivers").update(patch as any).eq("id", driver.id);
    if (error) {
      toast.error("Failed to update driver");
      return;
    }
    toast.success(`Driver ${status.replace("_", " ")}`);
    try {
      await supabase.from("transport_notifications").insert({
        user_id: driver.user_id,
        type: status === "approved" ? "driver_approved" : status === "rejected" ? "driver_rejected" : "driver_more_info",
        title: `Driver ${status === "more_info" ? "More Info" : status}`,
        message: reason || `Your driver application has been ${status}.`,
      });
    } catch { /* notification best-effort */ }
  };

  const toggleSuspend = async (driver: DriverProfile, suspend: boolean) => {
    const { error } = await supabase.from("agtrans_drivers").update({ admin_suspended: suspend }).eq("id", driver.id);
    if (error) toast.error("Failed to update suspension");
    else toast.success(suspend ? "Driver suspended" : "Driver reactivated");
  };

  const pendingDrivers = drivers.filter((d) => d.approval_status === "pending");
  const allDrivers = drivers;
  const activeDeliveries = deliveryJobs.filter((j) => j.status !== "Completed" && j.status !== "Cancelled");
  const completedDeliveries = deliveryJobs.filter((j) => j.status === "Completed");
  const disputedRequests = requests.filter((r) => r.status === "disputed" || r.negotiation_status === "disputed");

  const getSession = (job: DeliveryJob) => trackingSessions.find((s) => s.delivery_job_id === job.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">AGTrans Control Center</h1>
          <p className="text-sm text-muted-foreground">Manage driver approvals, monitor logistics, and handle disputes.</p>
        </div>
      </div>

      <Tabs defaultValue="drivers">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="live">Live Trips</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-yellow-600" /> Pending Driver Approvals ({pendingDrivers.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pendingDrivers.length === 0 ? <p className="text-sm text-muted-foreground">No pending drivers.</p> : (
                pendingDrivers.map((d) => (
                  <div key={d.id} className="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/10">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{d.full_name || "Unknown Partner"}</p>
                      <p className="text-xs text-muted-foreground">{d.vehicle_type} · {d.plate_number} · {d.phone}</p>
                      {d.license_url && <a href={d.license_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View License Document</a>}
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <Input className="text-xs" placeholder="Reason / info request" value={rejectionReasons[d.id] || ""} onChange={(e) => setRejectionReasons({ ...rejectionReasons, [d.id]: e.target.value })} />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setApproval(d, "rejected", rejectionReasons[d.id])}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                        <Button size="sm" variant="outline" onClick={() => setApproval(d, "more_info", rejectionReasons[d.id])}><HelpCircle className="h-3.5 w-3.5 mr-1" /> More Info</Button>
                        <Button size="sm" onClick={() => setApproval(d, "approved")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-5 w-5" /> All Drivers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {allDrivers.length === 0 ? <p className="text-sm text-muted-foreground">No driver profiles.</p> : (
                allDrivers.map((d) => (
                  <div key={d.id} className="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{d.full_name}</p>
                        <Badge variant={d.approval_status === "approved" ? "default" : d.approval_status === "rejected" ? "destructive" : "secondary"}>{d.approval_status}</Badge>
                        {d.admin_suspended && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{d.vehicle_type} · {d.plate_number} · Cap {d.vehicle_capacity_kg} kg</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedDriver(d)}><Eye className="h-3.5 w-3.5 mr-1" /> Docs</Button>
                      {d.admin_suspended ? (
                        <Button size="sm" onClick={() => toggleSuspend(d, false)}><PlayCircle className="h-3.5 w-3.5 mr-1" /> Reactivate</Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => toggleSuspend(d, true)}><PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspend</Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Navigation className="h-5 w-5 text-primary" /> Active Deliveries ({activeDeliveries.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeliveries.length === 0 ? <p className="text-sm text-muted-foreground">No active deliveries.</p> : (
                  activeDeliveries.map((job) => {
                    const session = getSession(job);
                    return (
                      <div key={job.id} className="border p-3 rounded-lg relative overflow-hidden bg-card">
                        <div className="absolute top-0 right-0 p-2">
                          <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>
                        </div>
                        <p className="font-semibold">{job.product}</p>
                        <p className="text-xs text-muted-foreground mb-2">{job.quantity} units</p>
                        <div className="text-xs space-y-1">
                          <p>From: {job.pickup_location}</p>
                          <p>To: {job.destination}</p>
                          <p>Driver: {job.driver_name}</p>
                          <p>Status: {job.status}</p>
                          {session && <p className="text-primary mt-2">ETA: {session.eta || "Calculating…"}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreements" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" /> Transport Agreements</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {agreements.length === 0 ? <p className="text-sm text-muted-foreground">No transport agreements.</p> : (
                agreements.map((a) => (
                  <div key={a.id} className="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="font-semibold text-sm">Agreement {a.id.substring(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Fee: GHS {a.agreed_fee} · {new Date(a.agreement_timestamp).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Status: {a.delivery_status}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedAgreement(a)}>View</Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Disputes ({disputedRequests.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {disputedRequests.length === 0 ? <p className="text-sm text-muted-foreground">No active disputes.</p> : (
                disputedRequests.map((r) => (
                  <div key={r.id} className="border p-3 rounded-lg border-destructive bg-destructive/5">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold">Tracking: {r.tracking_code}</p>
                        <p className="text-xs">{r.product_type} · {r.quantity} {r.unit}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { supabase.from("agtrans_requests").update({ status: "searching_driver" }).eq("id", r.id); toast.success("Dispute resolved"); }}>Resolve</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Driver Docs Dialog */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Verification Documents</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDriver(null)}>Close</Button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selectedDriver.full_name}</p>
              <p><strong>Phone:</strong> {selectedDriver.phone}</p>
              <p><strong>License Class:</strong> {selectedDriver.license_class}</p>
              <p><strong>Insurance:</strong> {selectedDriver.insurance_status || "—"}</p>
              <p><strong>Roadworthiness:</strong> {selectedDriver.roadworthiness_status || "—"}</p>
              {selectedDriver.license_url && <p><a href={selectedDriver.license_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">License / Document</a></p>}
              {selectedDriver.vehicle_images?.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {selectedDriver.vehicle_images.map((url, i) => <img key={i} src={url} alt="Vehicle" className="rounded-lg border" />)}
                </div>
              ) : <p>No vehicle images uploaded.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Agreement Dialog */}
      {selectedAgreement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Transport Agreement</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAgreement(null)}>Close</Button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Agreed Fee:</strong> GHS {selectedAgreement.agreed_fee}</p>
              <p><strong>Timestamp:</strong> {new Date(selectedAgreement.agreement_timestamp).toLocaleString()}</p>
              <p><strong>Delivery Status:</strong> {selectedAgreement.delivery_status}</p>
              <p><strong>Marketplace Order:</strong> {selectedAgreement.marketplace_order_id || "—"}</p>
              <p><strong>Driver:</strong> {selectedAgreement.driver_id.substring(0, 8)}</p>
              <p><strong>Supplier:</strong> {selectedAgreement.supplier_id?.substring(0, 8) || "—"}</p>
              <p><strong>Buyer:</strong> {selectedAgreement.buyer_id?.substring(0, 8) || "—"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
