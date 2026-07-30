import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plane, Shield, AlertTriangle, XCircle, CheckCircle, Upload, Globe, Bot, Badge as BadgeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useNewTag } from "@/hooks/useNewTag";
import { DroneOperationsConsole } from "@/components/drone/DroneOperationsConsole";

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
  const { isNew, markVisited } = useNewTag();

  const evaluate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("drone-advisory", {
        body: { missionType, targetLocation: position.locationName, plannedDate: new Date().toISOString(), droneType: droneType || undefined, altitude: Number(altitude), weatherData: forecast[0] },
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
    <div className="p-3 lg:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Plane className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Drone Operations &amp; Aerial Intelligence</h1>
          <p className="text-sm text-muted-foreground">Mission control · Dipa advisory · vision analytics</p>
        </div>
      </div>

      <Tabs defaultValue="operations" onValueChange={(val) => {
        if (val === "monitoring") { markVisited("drone-monitoring"); markVisited("drone-api"); }
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="operations" className="flex items-center gap-2">
            Operations Console
            <Badge variant="secondary" className="bg-cyan-900/50 text-cyan-400 border-cyan-800 text-[10px] px-1">LIVE</Badge>
          </TabsTrigger>
          <TabsTrigger value="advisory">Flight Evaluation</TabsTrigger>
          <TabsTrigger value="monitoring">
            Air Monitoring
            {isNew("drone-monitoring") && <Badge variant="secondary" className="ml-1 text-[10px] px-1">New</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
          <DroneOperationsConsole />
        </TabsContent>


        <TabsContent value="advisory">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Mission Intent Form */}
            <Card>
              <CardHeader><CardTitle className="text-base">Mission Intent</CardTitle></CardHeader>
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
                  <label className="text-sm font-medium mb-1.5 block">Aircraft/Drone Type (optional)</label>
                  <Input value={droneType} onChange={(e) => setDroneType(e.target.value)} placeholder="e.g. DJI Mavic 3" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Planned Altitude (m)</label>
                  <Input type="number" value={altitude} onChange={(e) => setAltitude(e.target.value)} min={10} max={400} />
                </div>
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
                      {(() => { const Icon = statusConfig[advisory.status].icon; return <Icon className={`h-8 w-8 ${statusConfig[advisory.status].color}`} />; })()}
                      <div>
                        <h2 className="font-bold text-lg">{statusConfig[advisory.status].label}</h2>
                        <p className="text-sm">{advisory.statusLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm">{advisory.summary}</p>
                  </div>
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div><p className="text-xs font-medium text-muted-foreground">Wind</p><p className="text-sm">{advisory.windAssessment}</p></div>
                      <div><p className="text-xs font-medium text-muted-foreground">Visibility</p><p className="text-sm">{advisory.visibilityAssessment}</p></div>
                      <div><p className="text-xs font-medium text-muted-foreground">Precipitation</p><p className="text-sm">{advisory.precipitationRisk}</p></div>
                      {advisory.temperatureNote && <div><p className="text-xs font-medium text-muted-foreground">Temperature</p><p className="text-sm">{advisory.temperatureNote}</p></div>}
                      <div><p className="text-xs font-medium text-muted-foreground">Recommended Window</p><p className="text-sm font-medium text-primary">{advisory.recommendedWindow}</p></div>
                    </CardContent>
                  </Card>
                  {advisory.precautions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Precautions & No-Fly Zone Warnings</CardTitle></CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5">
                          {advisory.precautions.map((p, i) => (
                            <li key={i} className="text-sm flex items-start gap-2"><span className="text-warning mt-0.5">⚠️</span> {p}</li>
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
                  <p className="text-sm text-muted-foreground">Submit your mission intent to receive a weather-based flight safety advisory.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* AIR MONITORING TAB */}
        <TabsContent value="monitoring">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Manual Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Manual Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Upload aerial data for Dipa to interpret patterns and generate advisories.</p>

                <UploadSection label="Aerial Images" accept="image/*" description="Upload aerial photos from drone or satellite" />
                <UploadSection label="Survey Videos" accept="video/*" description="Short survey footage for analysis" />
                <UploadSection label="NDVI / Vegetation Index Files" accept=".tif,.tiff,.geotiff,.csv,.json" description="Upload NDVI or spectral index data" />

                <div className="bg-muted rounded-lg p-3 mt-4">
                  <p className="text-xs font-medium mb-1">How it works</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Data stored securely in your account</li>
                    <li>• Dipa interprets patterns</li>
                    <li>• Outputs are advisory, not diagnostic</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* API Ingestion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> API Data Ingestion 
                  {isNew("drone-api") && (
                    <Badge variant="secondary" className="text-[10px]">New</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Connect controlled external APIs for periodic environmental and flight data sync.</p>

                <div className="space-y-3">
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Environmental Sensors</p>
                      <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Soil moisture, air quality, temperature probes</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Satellite Imagery API</p>
                      <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">NDVI, crop health, land use mapping</p>
                  </div>
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Flight Telemetry</p>
                      <Badge variant="outline" className="text-[10px]">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Real-time drone telemetry and mission logs</p>
                  </div>
                </div>

                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-medium mb-1">API Rules</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Controlled, rate-limited access</li>
                    <li>• Admin-approved connections</li>
                    <li>• Periodic data sync, no real-time control loops</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Intelligence Layer */}
          <Card className="mt-6 border-dashed border-primary/40">
            <CardContent className="pt-4 flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Dipa Intelligence Layer</p>
                <p className="text-xs text-muted-foreground">Dipa unifies both manual uploads and API data — interpreting patterns, simplifying outputs, translating into local language, and explaining risks with actionable recommendations.</p>
              </div>
              <Link to="/dipa">
                <Button size="sm" variant="default" className="shrink-0">Ask Dipa</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Use Cases */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { icon: "🗺️", label: "Farm Mapping" },
              { icon: "🌿", label: "Stress Detection" },
              { icon: "📊", label: "Environmental Monitoring" },
              { icon: "📐", label: "Expansion Planning" },
            ].map(uc => (
              <Card key={uc.label} className="text-center p-3">
                <p className="text-2xl mb-1">{uc.icon}</p>
                <p className="text-xs font-medium">{uc.label}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function UploadSection({ label, accept, description }: { label: string; accept: string; description: string }) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      toast({ title: "File selected", description: `${file.name} ready for processing. Full upload pipeline coming soon.` });
    }
  };

  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <p className="text-xs text-muted-foreground mb-1.5">{description}</p>
      <div className="relative">
        <input type="file" accept={accept} onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:bg-muted transition-colors cursor-pointer">
          <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{fileName || "Click or drag to upload"}</p>
        </div>
      </div>
    </div>
  );
}
