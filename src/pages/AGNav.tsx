import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Anchor, AlertTriangle, MapPin, Navigation, LifeBuoy, Layers, Loader2, Cloud } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { floodRisk } from "@/lib/riskEngine";

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Volta River basin (simplified ring – placeholder corridor for visual). Replace with real GeoJSON when available.
const VOLTA_BASIN: [number, number][] = [
  [9.5, -1.5], [9.0, -0.4], [7.8, 0.0], [6.5, 0.1], [6.0, -0.2], [6.6, -1.2], [8.2, -1.6], [9.5, -1.5],
];

const FLOOD_ZONES: { name: string; coords: [number, number][] }[] = [
  { name: "Lower Volta floodplain", coords: [[6.4, 0.2], [6.0, 0.3], [5.9, -0.1], [6.3, -0.1], [6.4, 0.2]] },
];

interface SOSEvent { id: string; created_at: string; lat: number; lon: number; }

function FlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lon], 9, { duration: 1.5 }); }, [lat, lon, map]);
  return null;
}

export default function AGNav() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const [showWeather, setShowWeather] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [showFarms, setShowFarms] = useState(true);
  const [showBoats, setShowBoats] = useState(true);
  const [farms, setFarms] = useState<{ id: string; lat: number; lon: number; name: string }[]>([]);
  const [boatTrail, setBoatTrail] = useState<[number, number][]>([]);
  const [sosBusy, setSosBusy] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Compute flood risk for current location from weather signals.
  const today = forecast?.[0];
  const fr = floodRisk({ rainProb: today?.rainProb, humidity: today?.humidity, riverLevelPct: 60 });

  useEffect(() => {
    // Use known farm QR codes as plotted markers when lat/lon available.
    supabase.from("farm_qr_codes").select("id,farm_name,farm_location").limit(50).then(({ data }) => {
      const items = (data || []).flatMap((r: any) => {
        const loc = String(r.farm_location || "");
        const m = loc.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (!m) return [];
        return [{ id: r.id, name: r.farm_name, lat: parseFloat(m[1]), lon: parseFloat(m[2]) }];
      });
      setFarms(items);
    });
  }, []);

  // Live track the current device GPS to show "boat" trail demo.
  useEffect(() => {
    if (!showBoats || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setBoatTrail((p) => [...p.slice(-200), [pos.coords.latitude, pos.coords.longitude]]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [showBoats]);

  const triggerSOS = async () => {
    if (!user) { toast.error("Sign in to send SOS"); return; }
    setSosBusy(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { error } = await supabase.from("disaster_alerts").insert({
          title: "SOS — User in distress",
          alert_type: "sos",
          severity: "critical",
          description: `User ${user.email} requested help at ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
          affected_regions: [`${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`],
          created_by: user.id,
          active: true,
        });
        if (error) toast.error(error.message);
        else toast.success("SOS broadcast sent");
        setSosBusy(false);
      }, () => { toast.error("Location unavailable"); setSosBusy(false); });
    } catch { setSosBusy(false); }
  };

  const center: [number, number] = [position.lat || 7.95, position.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Anchor className="h-6 w-6 text-primary" /> AGNav — Water Transport Navigator</h1>
          <p className="text-sm text-muted-foreground">Marine, river & farm intelligence for the Volta basin and surrounding regions.</p>
        </div>
        <Badge variant={fr.level === "critical" || fr.level === "high" ? "destructive" : "outline"} className="capitalize">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flood risk: {fr.level} ({fr.score})
        </Badge>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2"><Switch checked={showWeather} onCheckedChange={setShowWeather} id="w" /><Label htmlFor="w" className="text-xs flex items-center gap-1"><Cloud className="h-3.5 w-3.5" /> Weather</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showRisk} onCheckedChange={setShowRisk} id="r" /><Label htmlFor="r" className="text-xs flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Risk zones</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showFarms} onCheckedChange={setShowFarms} id="f" /><Label htmlFor="f" className="text-xs flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Farms</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showBoats} onCheckedChange={setShowBoats} id="b" /><Label htmlFor="b" className="text-xs flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> Live track</Label></div>
            <div className="flex items-center gap-2 ml-auto"><Layers className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Toggle base layer in map controls</span></div>
          </div>

          <div className="rounded-lg overflow-hidden border" style={{ height: "62vh", minHeight: 420 }}>
            <MapContainer center={center} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <FlyTo lat={center[0]} lon={center[1]} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Streets">
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="AGNav (terrain)">
                  <TileLayer attribution="© OpenTopoMap" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
              </LayersControl>

              {/* Volta Basin corridor */}
              <Polygon positions={VOLTA_BASIN} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.05 }} />

              {showRisk && FLOOD_ZONES.map((z) => (
                <Polygon key={z.name} positions={z.coords} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.25 }}>
                  <Popup>{z.name} — flood-prone</Popup>
                </Polygon>
              ))}

              {showWeather && today && (
                <CircleMarker center={center} radius={Math.max(8, (today.rainProb || 0) / 5)}
                  pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.25 }}>
                  <Popup>Rain {today.rainProb}% · {today.tempMin}–{today.tempMax}°C · {today.description}</Popup>
                </CircleMarker>
              )}

              <Marker position={center}><Popup>You are here · {position.locationName}</Popup></Marker>

              {showFarms && farms.map((f) => (
                <Marker key={f.id} position={[f.lat, f.lon]}><Popup>{f.name}</Popup></Marker>
              ))}

              {showBoats && boatTrail.length > 1 && (
                <Polyline positions={boatTrail} pathOptions={{ color: "#16a34a", weight: 3 }} />
              )}
            </MapContainer>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Button variant="destructive" disabled={sosBusy} onClick={triggerSOS}>
              {sosBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LifeBuoy className="h-4 w-4 mr-1" />}
              SOS
            </Button>
            <span className="text-xs text-muted-foreground">{fr.rationale} — {fr.recommendations.join(" · ")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
