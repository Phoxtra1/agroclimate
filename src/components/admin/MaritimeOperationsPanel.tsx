import { useCallback, useEffect, useMemo, useState } from "react";
import { Anchor, LifeBuoy, Phone, Radio, RefreshCw, ShieldAlert, Ship, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";
import { toast } from "sonner";

interface VesselRow {
  id: string;
  vessel_name: string | null;
  operator_name: string | null;
  operator_type: string | null;
  phone_number: string | null;
  status: string;
  has_rescue_capability: boolean;
  created_at: string;
}
interface PositionRow {
  id: string;
  vessel_id: string;
  lat: number;
  lon: number;
  accuracy_m?: number | null;
  location_source: string;
  captured_at: string;
  created_at: string;
}
interface EventRow {
  id: string;
  vessel_id: string;
  lat: number;
  lon: number;
  status: string;
  risk_level: string;
  accepted_by_vessel_id: string | null;
  eta_minutes: number | null;
  created_at: string;
  resolved_at: string | null;
  message: string | null;
}
interface ResponderRow {
  id: string;
  name: string;
  agency: string | null;
  phone_number: string | null;
  region: string | null;
  active: boolean;
}

export function MaritimeOperationsPanel() {
  const [vessels, setVessels] = useState<VesselRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [responders, setResponders] = useState<ResponderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingResponder, setSavingResponder] = useState(false);
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("marine_police");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [vesselResult, locationResult, eventResult, responderResult] = await Promise.all([
        (supabase.from("vessels" as any) as any).select("*").order("created_at", { ascending: false }).limit(300),
        (supabase.from("vessel_locations" as any) as any).select("*").eq("location_source", "device_gps").lte("accuracy_m", 100).order("captured_at", { ascending: false }).limit(1000),
        (supabase.from("sos_events" as any) as any).select("*").order("created_at", { ascending: false }).limit(200),
        (supabase.from("external_responders" as any) as any).select("*").order("name"),
      ]);
      const failed = [vesselResult, locationResult, eventResult, responderResult].find((result) => result.error);
      if (failed?.error) throw failed.error;

      setVessels((vesselResult.data ?? []) as VesselRow[]);
      setPositions((locationResult.data ?? []) as PositionRow[]);
      setEvents((eventResult.data ?? []) as EventRow[]);
      setResponders((responderResult.data ?? []) as ResponderRow[]);
    } catch (error) {
      toast.error("Maritime operations data unavailable", { description: error instanceof Error ? error.message : "Could not load maritime records." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const channel = supabase.channel("admin-maritime-operations")
      .on("postgres_changes", { event: "*", schema: "public", table: "vessel_locations" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vessels" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "external_responders" }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  const latestPositions = useMemo(() => {
    const seen = new Set<string>();
    return positions.filter((position) => {
      if (position.location_source !== "device_gps" || !Number.isFinite(position.accuracy_m) || (position.accuracy_m ?? Infinity) > 100) return false;
      if (seen.has(position.vessel_id)) return false;
      seen.add(position.vessel_id);
      return true;
    });
  }, [positions]);

  const activeCount = vessels.filter((vessel) => vessel.status === "ACTIVE").length;
  const openCount = events.filter((event) => event.status !== "RESOLVED").length;
  const rescueCount = vessels.filter((vessel) => vessel.has_rescue_capability).length;

  const addResponder = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Responder name and contact number are required.");
      return;
    }
    setSavingResponder(true);
    try {
      const { error } = await (supabase.from("external_responders" as any) as any).insert({
        name: name.trim(),
        agency,
        phone_number: phone.trim(),
        region: region.trim() || null,
        active: true,
      });
      if (error) throw error;
      setName(""); setPhone(""); setRegion("");
      toast.success("Responder directory entry saved.");
      await refresh();
    } catch (error) {
      toast.error("Could not save responder", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingResponder(false);
    }
  };

  const toggleResponder = async (responder: ResponderRow) => {
    const { error } = await (supabase.from("external_responders" as any) as any)
      .update({ active: !responder.active }).eq("id", responder.id);
    if (error) toast.error("Responder status could not be changed", { description: error.message });
    else await refresh();
  };

  const deleteResponder = async (id: string) => {
    const { error } = await (supabase.from("external_responders" as any) as any).delete().eq("id", id);
    if (error) toast.error("Responder could not be removed", { description: error.message });
    else await refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Anchor className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Maritime Safety &amp; Rescue Operations</h1>
          <p className="text-xs text-muted-foreground">Vessel directory, received distress events and responder directory · viewed through shared Satellite</p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><Ship className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-2xl font-bold">{vessels.length}</p><p className="text-xs text-muted-foreground">Registered vessels</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Radio className="mx-auto h-4 w-4 text-emerald-600" /><p className="mt-1 text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Marked active</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><ShieldAlert className="mx-auto h-4 w-4 text-rose-600" /><p className="mt-1 text-2xl font-bold">{openCount}</p><p className="text-xs text-muted-foreground">Open SOS events</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><LifeBuoy className="mx-auto h-4 w-4 text-sky-600" /><p className="mt-1 text-2xl font-bold">{rescueCount}</p><p className="text-xs text-muted-foreground">Rescue-capable vessels</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Distress events</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!events.length && <p className="text-sm text-muted-foreground">No recorded SOS events.</p>}
          {events.slice(0, 30).map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {event.vessel_id}
                  <Badge variant={event.status === "RESOLVED" ? "secondary" : "destructive"}>{event.status}</Badge>
                  <Badge variant="outline">{event.risk_level}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()} {event.accepted_by_vessel_id ? `· accepted by ${event.accepted_by_vessel_id}` : ""}</div>
                {event.message && <div className="mt-1 text-xs">{event.message}</div>}
              </div>
              <OpenInSatelliteButton lat={event.lat} lon={event.lon} label={`Maritime SOS ${event.id.slice(0, 8)}`} zoom={15}>
                Inspect in Satellite
              </OpenInSatelliteButton>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ship className="h-4 w-4" /> Vessel directory &amp; latest shared positions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {vessels.slice(0, 100).map((vessel) => {
            const position = latestPositions.find((item) => item.vessel_id === vessel.id);
            return (
              <div key={vessel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-semibold">{vessel.vessel_name || vessel.id}</div>
                  <div className="text-xs text-muted-foreground">{vessel.id} · {vessel.operator_name || "Operator not recorded"} · {vessel.status}</div>
                  {position && <div className="mt-1 text-[10px] text-muted-foreground">Device GPS fix {new Date(position.captured_at).toLocaleString()} · ±{Math.round(position.accuracy_m ?? 0)} m</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{vessel.has_rescue_capability ? "Rescue capable" : "Not marked rescue capable"}</Badge>
                  {position && <OpenInSatelliteButton lat={position.lat} lon={position.lon} label={`Last vessel position · ${vessel.id}`} zoom={15}>Inspect last GPS</OpenInSatelliteButton>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> External responder directory</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Agency / team name" />
            <Select value={agency} onValueChange={setAgency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="navy">Navy</SelectItem>
                <SelectItem value="marine_police">Marine Police</SelectItem>
                <SelectItem value="nadmo">NADMO</SelectItem>
                <SelectItem value="port_authority">Port authority</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Official contact number" />
            <Input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Region / coverage area" />
          </div>
          <Button size="sm" onClick={() => void addResponder()} disabled={savingResponder}>
            <Phone className="mr-2 h-3.5 w-3.5" /> Add responder
          </Button>
          {responders.map((responder) => (
            <div key={responder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">{responder.name}</div>
                <div className="text-xs text-muted-foreground">{responder.agency || "Other"} · {responder.region || "Coverage area not specified"} · {responder.phone_number || "No contact recorded"}</div>
              </div>
              <div className="flex gap-2">
                <Badge variant={responder.active ? "default" : "secondary"}>{responder.active ? "Active directory entry" : "Inactive"}</Badge>
                <Button size="sm" variant="outline" onClick={() => void toggleResponder(responder)}>{responder.active ? "Deactivate" : "Activate"}</Button>
                <Button size="sm" variant="destructive" onClick={() => void deleteResponder(responder.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        This is an administrator directory and platform event view. It does not replace emergency dispatch. A vessel's status is user-managed and a last GPS record may be stale. Only a recent recorded location should be used as current position.
      </p>
    </div>
  );
}
