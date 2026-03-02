import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plane, Shield, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";

interface FlightAdvisory {
  status: "safe" | "caution" | "no_fly";
  statusLabel: string;
  summary: string;
  windAssessment: string;
  visibilityAssessment: string;
  precipitationRisk: string;
  temperatureNote?: string;
  recommendedWindow: string;
  precautions: string[];
  alternativeActions?: string[];
}

export default function DroneAdvisory() {
  const [missionType, setMissionType] = useState("monitoring");
  const [droneType, setDroneType] = useState("");
  const [altitude, setAltitude] = useState("50");
  const [advisory, setAdvisory] = useState<FlightAdvisory | null>(null);
  const [loading, setLoading] = useState(false);
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const { toast } = useToast();

  const evaluate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("drone-advisory", {
        body: {
          missionType,
          targetLocation: position.locationName,
          plannedDate: new Date().toISOString(),
          droneType: droneType || undefined,
          altitude: Number(altitude),
          weatherData: forecast[0],
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Evaluation failed");
      setAdvisory(data.advisory);
    } catch (err: any) {
      toast({ title: "Advisory Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    safe: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "🟢 Safe to Fly" },
    caution: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "🟡 Fly with Caution" },
    no_fly: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "🔴 Do Not Fly" },
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Plane className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Flight Advisory</h1>
          <p className="text-sm text-muted-foreground">Weather-based flight safety evaluation for drones, helicopters & light aircraft</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Mission Intent Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mission Intent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mission Type</label>
              <Select value={missionType} onValueChange={setMissionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monitoring">Crop Monitoring</SelectItem>
                  <SelectItem value="spraying">Chemical Spraying</SelectItem>
                  <SelectItem value="surveying">Land Surveying</SelectItem>
                  <SelectItem value="mapping">Aerial Mapping</SelectItem>
                  <SelectItem value="forestry">Forestry Patrol</SelectItem>
                  <SelectItem value="helicopter">Helicopter Flight</SelectItem>
                  <SelectItem value="light_aircraft">Light Aircraft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Location</label>
              <Input value={position.locationName} disabled />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Drone Type (optional)</label>
              <Input
                value={droneType}
                onChange={(e) => setDroneType(e.target.value)}
                placeholder="e.g. DJI Mavic 3"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Planned Altitude (m)</label>
              <Input
                type="number"
                value={altitude}
                onChange={(e) => setAltitude(e.target.value)}
                min={10}
                max={400}
              />
            </div>

            {/* Current conditions preview */}
            {forecast[0] && (
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current Conditions</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>🌡️ {forecast[0].tempHigh}°C</span>
                  <span>💨 {forecast[0].wind} km/h</span>
                  <span>💧 {forecast[0].humidity}%</span>
                  <span>🌧️ {forecast[0].rainProb}% rain</span>
                </div>
              </div>
            )}

            <Button onClick={evaluate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Evaluate Flight Safety
            </Button>
          </CardContent>
        </Card>

        {/* Advisory Result */}
        <div className="space-y-4">
          {advisory ? (
            <>
              <div className={`rounded-xl p-5 ${statusConfig[advisory.status].bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  {(() => {
                    const Icon = statusConfig[advisory.status].icon;
                    return <Icon className={`h-8 w-8 ${statusConfig[advisory.status].color}`} />;
                  })()}
                  <div>
                    <h2 className="font-bold text-lg">{statusConfig[advisory.status].label}</h2>
                    <p className="text-sm">{advisory.statusLabel}</p>
                  </div>
                </div>
                <p className="text-sm">{advisory.summary}</p>
              </div>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Wind Assessment</p>
                    <p className="text-sm">{advisory.windAssessment}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Visibility</p>
                    <p className="text-sm">{advisory.visibilityAssessment}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Precipitation Risk</p>
                    <p className="text-sm">{advisory.precipitationRisk}</p>
                  </div>
                  {advisory.temperatureNote && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Temperature</p>
                      <p className="text-sm">{advisory.temperatureNote}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Recommended Window</p>
                    <p className="text-sm font-medium text-primary">{advisory.recommendedWindow}</p>
                  </div>
                </CardContent>
              </Card>

              {advisory.precautions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Precautions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {advisory.precautions.map((p, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-warning mt-0.5">⚠️</span> {p}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="bg-card rounded-xl p-8 text-center border border-border">
              <Plane className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2">No Evaluation Yet</h3>
              <p className="text-sm text-muted-foreground">
                Submit your mission intent to receive a weather-based flight safety advisory.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
