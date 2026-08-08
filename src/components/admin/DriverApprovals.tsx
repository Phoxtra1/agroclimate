import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, HelpCircle, PauseCircle, PlayCircle, RefreshCw, Eye } from "lucide-react";
import type { DriverProfile } from "@/hooks/useAGTrans";

type DriverAction = "approve" | "reject" | "more_info" | "suspend" | "reactivate";

export function useDriverApprovals() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: fnError } = await supabase.functions.invoke("admin-agtrans-drivers", {
      body: { action: "list" },
    });
    if (fnError || data?.error) {
      setError(data?.error || "Driver registrations could not be loaded.");
    } else {
      setError(null);
      setDrivers((data?.drivers as DriverProfile[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Real-time: any driver row change re-pulls the approval queue immediately.
    const channel = supabase
      .channel("admin-driver-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, () => load())
      .subscribe();
    // Safety net for environments where realtime is unavailable.
    const poll = window.setInterval(load, 20000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [load]);

  const act = useCallback(async (driverId: string, action: DriverAction, reason?: string) => {
    const { data, error: fnError } = await supabase.functions.invoke("admin-agtrans-drivers", {
      body: { action, driver_id: driverId, reason },
    });
    if (fnError || data?.error) {
      toast.error(data?.error || "Action failed");
      return false;
    }
    toast.success(`Driver ${action.replace("_", " ")}`);
    await load();
    return true;
  }, [load]);

  return { drivers, loading, error, reload: load, act };
}

export default function DriverApprovals({ onViewDocs }: { onViewDocs?: (d: DriverProfile) => void }) {
  const { drivers, loading, error, reload, act } = useDriverApprovals();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const pending = drivers.filter((d) => d.approval_status === "pending" || d.approval_status === "more_info");
  const decided = drivers.filter((d) => !pending.includes(d));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-yellow-600" /> Driver Registrations Awaiting Approval ({pending.length})
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p>
            : loading ? <p className="text-sm text-muted-foreground">Loading registrations…</p>
            : pending.length === 0 ? <p className="text-sm text-muted-foreground">No registrations awaiting approval.</p>
            : pending.map((d) => (
              <div key={d.id} className="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{d.full_name || "Unknown Partner"}</p>
                    <Badge variant="secondary">{d.approval_status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.vehicle_type} · {d.plate_number} · {d.phone}</p>
                  {d.created_at && <p className="text-xs text-muted-foreground">Registered {new Date(d.created_at).toLocaleString()}</p>}
                  {d.license_url && <a href={d.license_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View License Document</a>}
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Input className="text-xs" placeholder="Reason / info request"
                    value={reasons[d.id] || ""}
                    onChange={(e) => setReasons({ ...reasons, [d.id]: e.target.value })} />
                  <div className="flex gap-2 justify-end flex-wrap">
                    {onViewDocs && <Button size="sm" variant="ghost" onClick={() => onViewDocs(d)}><Eye className="h-3.5 w-3.5 mr-1" /> Docs</Button>}
                    <Button size="sm" variant="outline" onClick={() => act(d.id, "reject", reasons[d.id])}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                    <Button size="sm" variant="outline" onClick={() => act(d.id, "more_info", reasons[d.id])}><HelpCircle className="h-3.5 w-3.5 mr-1" /> More Info</Button>
                    <Button size="sm" onClick={() => act(d.id, "approve")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reviewed Drivers ({decided.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {decided.length === 0 ? <p className="text-sm text-muted-foreground">No reviewed drivers yet.</p> : decided.map((d) => (
            <div key={d.id} className="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{d.full_name}</p>
                  <Badge variant={d.approval_status === "approved" ? "default" : d.approval_status === "rejected" ? "destructive" : "secondary"}>{d.approval_status}</Badge>
                  {d.admin_suspended && <Badge variant="destructive">Suspended</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{d.vehicle_type} · {d.plate_number}</p>
              </div>
              <div className="flex gap-2">
                {onViewDocs && <Button size="sm" variant="outline" onClick={() => onViewDocs(d)}><Eye className="h-3.5 w-3.5 mr-1" /> Docs</Button>}
                {d.admin_suspended
                  ? <Button size="sm" onClick={() => act(d.id, "reactivate")}><PlayCircle className="h-3.5 w-3.5 mr-1" /> Reactivate</Button>
                  : <Button size="sm" variant="destructive" onClick={() => act(d.id, "suspend")}><PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspend</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
