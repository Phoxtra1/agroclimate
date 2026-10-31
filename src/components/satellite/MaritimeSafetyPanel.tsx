import { useCallback, useEffect, useRef, useState } from "react";
import { Anchor, LifeBuoy, Loader2, MapPin, MessageSquare, Radio, Send, Ship, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { GeoPoint } from "@/services/satellite/navigation";
import {
  acceptMaritimeSos,
  broadcastMaritimeSos,
  listMaritimeMessages,
  listMyVessels,
  listOpenMaritimeEvents,
  registerMyVessel,
  resolveMaritimeSos,
  saveMyVesselLocation,
  sendMaritimeMessage,
  setMyVesselStatus,
  subscribeMaritimeEvents,
  subscribeMaritimeMessages,
  type MaritimeSosEvent,
  type VesselRecord,
} from "@/services/satellite/maritime";

interface GPSFix {
  point: GeoPoint;
  accuracyM: number;
  timestamp: number;
  speedMps: number | null;
  headingDeg: number | null;
}

export interface MaritimeMapPosition {
  vesselId: string;
  vesselName: string;
  point: GeoPoint;
  capturedAt: string;
}

interface Props {
  onInspectLocation: (point: GeoPoint, label: string) => void;
  onMapDataChange?: (events: MaritimeSosEvent[], positions: MaritimeMapPosition[]) => void;
}

export function MaritimeSafetyPanel({ onInspectLocation, onMapDataChange }: Props) {
  const [vessels, setVessels] = useState<VesselRecord[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState("");
  const [events, setEvents] = useState<MaritimeSosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [gpsFix, setGpsFix] = useState<GPSFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [vesselName, setVesselName] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [operatorType, setOperatorType] = useState<"private" | "commercial" | "rescue_team" | "navy">("commercial");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [rescueCapable, setRescueCapable] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationWriteRef = useRef(0);
  const gpsRef = useRef<GPSFix | null>(null);
  const selectedVessel = vessels.find((vessel) => vessel.id === selectedVesselId) ?? null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [myVessels, openEvents] = await Promise.all([listMyVessels(), listOpenMaritimeEvents()]);
      setVessels(myVessels);
      setEvents(openEvents);
      setSelectedVesselId((current) => current && myVessels.some((item) => item.id === current) ? current : (myVessels[0]?.id ?? ""));
      setSelectedEventId((current) => current && openEvents.some((item) => item.id === current) ? current : (openEvents[0]?.id ?? ""));
    } catch (error) {
      toast.error("Maritime workspace unavailable", { description: error instanceof Error ? error.message : "Could not load maritime records." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeMaritimeEvents(() => { void refresh(); });
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    if (!selectedEventId) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const rows = await listMaritimeMessages(selectedEventId);
        if (active) setMessages(rows);
      } catch (error) {
        if (active) toast.error("Could not load maritime messages", { description: error instanceof Error ? error.message : undefined });
      }
    };
    void load();
    const unsubscribe = subscribeMaritimeMessages(selectedEventId, (row) => {
      setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, row]);
    });
    return () => { active = false; unsubscribe(); };
  }, [selectedEventId]);

  useEffect(() => {
    const positions: MaritimeMapPosition[] = [];
    if (gpsFix && selectedVessel) {
      positions.push({
        vesselId: selectedVessel.id,
        vesselName: selectedVessel.vessel_name || selectedVessel.id,
        point: gpsFix.point,
        capturedAt: new Date(gpsFix.timestamp).toISOString(),
      });
    }
    onMapDataChange?.(events, positions);
  }, [events, gpsFix, selectedVessel, onMapDataChange]);

  const stopLocationSharing = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  }, []);

  useEffect(() => () => stopLocationSharing(), [stopLocationSharing]);

  const startLocationSharing = () => {
    if (!selectedVessel) return;
    if (!navigator.geolocation) {
      setGpsError("This browser does not provide GPS location.");
      return;
    }
    if (!navigator.onLine) {
      setGpsError("Connect to the internet before enabling vessel location sharing.");
      return;
    }
    setGpsError("");
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(async (position) => {
      const fix: GPSFix = {
        point: { lat: position.coords.latitude, lon: position.coords.longitude },
        accuracyM: position.coords.accuracy,
        timestamp: position.timestamp,
        speedMps: position.coords.speed,
        headingDeg: position.coords.heading,
      };
      gpsRef.current = fix;
      setGpsFix(fix);
      if (Date.now() - lastLocationWriteRef.current < 20000) return;
      lastLocationWriteRef.current = Date.now();
      try {
        await saveMyVesselLocation({
          vesselId: selectedVessel.id,
          point: fix.point,
          accuracyM: fix.accuracyM,
          speedMps: fix.speedMps,
          headingDeg: fix.headingDeg,
        });
      } catch (error) {
        setGpsError(error instanceof Error ? error.message : "Could not share this GPS update.");
      }
    }, (error) => {
      setGpsError(error.message);
      stopLocationSharing();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };

  const ensureFreshGPS = () => {
    const fix = gpsRef.current;
    if (!fix || Date.now() - fix.timestamp > 30000) {
      throw new Error("A fresh GPS fix is required. Start location sharing and wait for a current position.");
    }
    if (fix.accuracyM > 100) {
      throw new Error("GPS accuracy is currently too low for this safety action. Move to a clearer area and retry.");
    }
    return fix;
  };

  const handleRegister = async () => {
    if (!vesselName.trim() || !operatorName.trim()) {
      toast.error("Vessel name and operator name are required.");
      return;
    }
    setActionBusy(true);
    try {
      const vessel = await registerMyVessel({
        vesselName, operatorName, operatorType, phoneNumber, rescueCapable,
        homeLocation: gpsFix?.point,
      });
      toast.success("Vessel registered", { description: vessel.id });
      setRegisterOpen(false);
      setVesselName("");
      setOperatorName("");
      setPhoneNumber("");
      setRescueCapable(false);
      await refresh();
      setSelectedVesselId(vessel.id);
    } catch (error) {
      toast.error("Vessel registration failed", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleStatus = async (status: "ACTIVE" | "BUSY" | "OFFLINE") => {
    if (!selectedVessel) return;
    setActionBusy(true);
    try {
      if (status === "OFFLINE") stopLocationSharing();
      await setMyVesselStatus(selectedVessel.id, status);
      await refresh();
      toast.success(`Vessel status set to ${status.toLowerCase()}.`);
    } catch (error) {
      toast.error("Could not update vessel status", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSOS = async () => {
    if (!selectedVessel) return;
    if (!navigator.onLine) {
      toast.error("SOS cannot be broadcast while offline. Use your local emergency radio or telephone service.");
      return;
    }
    setActionBusy(true);
    try {
      const fix = ensureFreshGPS();
      const result = await broadcastMaritimeSos({
        vesselId: selectedVessel.id,
        point: fix.point,
        riskLevel: "high",
        message: "Emergency assistance requested. Please contact the reporting vessel.",
      });
      toast.success("SOS broadcast recorded", {
        description: `${result.notified_vessels.length} nearby platform vessels and ${result.notified_responders.length} registered responders were included. Platform broadcast is not confirmation that anyone received or accepted the request.`,
      });
      setSelectedEventId(result.event.id);
      await refresh();
    } catch (error) {
      toast.error("SOS broadcast failed", { description: error instanceof Error ? error.message : "No acknowledgement was received." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleAccept = async (event: MaritimeSosEvent) => {
    if (!selectedVessel) return;
    setActionBusy(true);
    try {
      const fix = ensureFreshGPS();
      const result = await acceptMaritimeSos({ eventId: event.id, vesselId: selectedVessel.id, point: fix.point });
      toast.success("Rescue acceptance recorded", {
        description: `Estimated straight-line distance ${result.straight_line_distance_km} km; planning ETA ${result.eta_minutes} min. This is not a waterway route or travel-time guarantee.`,
      });
      onInspectLocation({ lat: event.lat, lon: event.lon }, `Maritime emergency ${event.id.slice(0, 8)}`);
      await refresh();
    } catch (error) {
      toast.error("Could not accept emergency", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setActionBusy(false);
    }
  };

  const handleResolve = async (event: MaritimeSosEvent) => {
    if (!selectedVessel) return;
    setActionBusy(true);
    try {
      await resolveMaritimeSos(event.id, selectedVessel.id);
      toast.success("Emergency marked resolved.");
      await refresh();
    } catch (error) {
      toast.error("Could not resolve emergency", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedVessel || !selectedEvent || !messageText.trim()) return;
    setActionBusy(true);
    try {
      await sendMaritimeMessage(selectedEvent.id, selectedVessel.id, messageText.trim());
      setMessageText("");
      const rows = await listMaritimeMessages(selectedEvent.id);
      setMessages(rows);
    } catch (error) {
      toast.error("Message could not be sent", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <Card className="border-slate-700 bg-[#0a1222]/95 text-slate-100 shadow-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-mono text-sky-300">
          <Anchor className="h-4 w-4" /> MARITIME SAFETY &amp; RESCUE
          <Badge variant="outline" className="ml-auto border-slate-700 text-[9px]">{events.length} open</Badge>
        </CardTitle>
        <p className="text-[10px] leading-relaxed text-slate-400">Shared Satellite map and vessel safety workflow. Location sharing is user-controlled; SOS broadcasts require a fresh GPS fix and an online connection.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="py-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : null}
        <div className="flex flex-wrap gap-2">
          {vessels.length > 0 ? (
            <select className="h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
              value={selectedVesselId} onChange={(event) => { stopLocationSharing(); setSelectedVesselId(event.target.value); setGpsFix(null); }}>
              {vessels.map((vessel) => <option key={vessel.id} value={vessel.id}>{vessel.vessel_name || vessel.id} · {vessel.status}</option>)}
            </select>
          ) : null}
          <Button size="sm" variant="outline" className="h-9 border-slate-700 bg-slate-900 text-xs" onClick={() => setRegisterOpen((value) => !value)}>
            <Ship className="mr-1 h-3.5 w-3.5" /> Register vessel
          </Button>
        </div>

        {registerOpen && (
          <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/80 p-3">
            <Label className="text-xs text-slate-300">Vessel name</Label>
            <Input value={vesselName} onChange={(event) => setVesselName(event.target.value)} className="h-9 border-slate-700 bg-slate-950 text-xs" />
            <Label className="text-xs text-slate-300">Operator / company name</Label>
            <Input value={operatorName} onChange={(event) => setOperatorName(event.target.value)} className="h-9 border-slate-700 bg-slate-950 text-xs" />
            <Label className="text-xs text-slate-300">Phone number (optional)</Label>
            <Input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="h-9 border-slate-700 bg-slate-950 text-xs" />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={rescueCapable} onChange={(event) => setRescueCapable(event.target.checked)} />
              Rescue-capable vessel
            </label>
            <Button size="sm" className="w-full h-9" onClick={() => void handleRegister()} disabled={actionBusy}>
              {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save vessel registration
            </Button>
          </div>
        )}

        {selectedVessel ? (
          <>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">{selectedVessel.vessel_name || selectedVessel.id}</div>
                  <div className="text-[10px] text-slate-400">{selectedVessel.id} · {selectedVessel.operator_name || "Operator not recorded"}</div>
                </div>
                <Badge variant="outline" className="border-slate-600 text-[9px]">{selectedVessel.status}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {!sharing ? (
                  <Button size="sm" className="h-8 text-[10px]" onClick={startLocationSharing} disabled={actionBusy || !navigator.onLine}>
                    <Radio className="mr-1 h-3.5 w-3.5" /> Share GPS location
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" className="h-8 text-[10px]" onClick={stopLocationSharing}>
                    Stop sharing
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 border-slate-700 text-[10px]" onClick={() => void handleStatus("ACTIVE")} disabled={actionBusy}>Available</Button>
                <Button size="sm" variant="outline" className="h-8 border-slate-700 text-[10px]" onClick={() => void handleStatus("OFFLINE")} disabled={actionBusy}>Offline</Button>
              </div>
              {gpsFix && (
                <div className="mt-2 text-[10px] text-slate-300">
                  GPS {gpsFix.point.lat.toFixed(5)}, {gpsFix.point.lon.toFixed(5)} · ±{Math.round(gpsFix.accuracyM)} m · {new Date(gpsFix.timestamp).toLocaleTimeString()}
                </div>
              )}
              {gpsError && <p className="mt-2 text-[10px] text-amber-300">{gpsError}</p>}
              <Button size="sm" variant="destructive" className="mt-3 w-full h-10 font-bold" onClick={() => void handleSOS()} disabled={actionBusy || !sharing || !gpsFix || !navigator.onLine}>
                <LifeBuoy className="mr-2 h-4 w-4" /> BROADCAST MARITIME SOS
              </Button>
              {!navigator.onLine && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-300"><WifiOff className="h-3 w-3" /> Offline. SOS delivery cannot be confirmed.</p>}
            </div>
          </>
        ) : (
          !loading && <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">No vessel is registered to this account. Register your vessel before sharing location or using the rescue workflow.</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Open emergencies</div>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-slate-400" onClick={() => void refresh()}>Refresh</Button>
          </div>
          {events.length === 0 && !loading && <p className="text-[10px] text-slate-500">No open emergencies visible to this account.</p>}
          {events.map((event) => {
            const isMine = event.vessel_id === selectedVesselId;
            const canAccept = event.status === "BROADCAST" && !isMine && selectedVesselId
              && (event.notified_vessels ?? []).some((item) => item.vessel_id === selectedVesselId);
            const isAcceptedByMe = event.accepted_by_vessel_id === selectedVesselId;
            return (
              <div key={event.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
                <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => { setSelectedEventId(event.id); onInspectLocation({ lat: event.lat, lon: event.lon }, `Maritime SOS ${event.id.slice(0, 8)}`); }}>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{event.vessel_id}</div>
                    <div className="text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString()} · {event.risk_level}</div>
                  </div>
                  <Badge variant={event.status === "ACCEPTED" ? "default" : "destructive"} className="text-[9px]">{event.status}</Badge>
                </button>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 border-slate-700 text-[10px]" onClick={() => onInspectLocation({ lat: event.lat, lon: event.lon }, `Maritime SOS ${event.id.slice(0, 8)}`)}>
                    <MapPin className="mr-1 h-3 w-3" /> Inspect on map
                  </Button>
                  {canAccept && (
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => void handleAccept(event)} disabled={!sharing || !gpsFix || actionBusy}>
                      Accept rescue
                    </Button>
                  )}
                  {(isMine || isAcceptedByMe) && event.status !== "RESOLVED" && (
                    <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => void handleResolve(event)} disabled={actionBusy}>
                      Mark resolved
                    </Button>
                  )}
                </div>
                {event.status === "ACCEPTED" && <p className="mt-2 text-[10px] text-emerald-300">Responder accepted. Planning ETA {event.eta_minutes ?? "—"} minutes is a straight-line estimate only.</p>}
              </div>
            );
          })}
        </div>

        {selectedEvent && selectedVessel && (selectedEvent.vessel_id === selectedVessel.id || selectedEvent.accepted_by_vessel_id === selectedVessel.id) && (
          <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold"><MessageSquare className="h-3.5 w-3.5" /> Rescue communication</div>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {messages.map((message) => <div key={message.id} className="text-[10px] text-slate-300"><span className="font-semibold">{message.from_vessel_id}:</span> {message.body}</div>)}
              {!messages.length && <p className="text-[10px] text-slate-500">No messages yet.</p>}
            </div>
            <div className="flex gap-2">
              <Textarea rows={2} value={messageText} onChange={(event) => setMessageText(event.target.value)} className="min-h-0 border-slate-700 bg-slate-950 text-[10px]" placeholder="Send an update to the other vessel…" />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => void handleSendMessage()} disabled={!messageText.trim() || actionBusy}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <p className="text-[9px] leading-relaxed text-slate-500">
          Platform emergency messages are not a replacement for coast guard, port authority, local emergency or marine-radio procedures. The map is a location aid, not an approved chart or navigational clearance.
        </p>
      </CardContent>
    </Card>
  );
}
