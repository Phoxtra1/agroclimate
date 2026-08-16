import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Navigation, AlertTriangle, FileText } from "lucide-react";
import { useAGTrans, DriverProfile, DeliveryJob, TransportAgreement } from "@/hooks/useAGTrans";
import DriverApprovals from "@/components/admin/DriverApprovals";

export default function AdminAGTransPanel() {
  const { requests, deliveryJobs, trackingSessions } = useAGTrans();
  const [agreements, setAgreements] = useState<TransportAgreement[]>([]);
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

  const activeDeliveries = deliveryJobs.filter((j) => j.status !== "Completed" && j.status !== "Cancelled");

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
          <DriverApprovals onViewDocs={setSelectedDriver} />
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
              {selectedDriver.license_url && (
                <p>
                  <button type="button" className="text-primary hover:underline" onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("admin-agtrans-drivers", {
                      body: { action: "license_url", driver_id: selectedDriver.id },
                    });
                    if (error || data?.error || !data?.url) { toast.error(data?.error || "Document could not be opened."); return; }
                    window.open(data.url as string, "_blank", "noopener,noreferrer");
                  }}>License / Document</button>
                </p>
              )}
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
