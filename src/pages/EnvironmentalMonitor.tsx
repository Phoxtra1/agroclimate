import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wind, Thermometer, Droplets, Eye, AlertTriangle, CloudRain } from "lucide-react";

function getAirQualityInference(weather: any) {
  if (!weather) return { level: "Unknown", color: "bg-muted", risks: [] };
  const risks: string[] = [];
  let level = "Good";
  let color = "bg-success/10 text-success";

  if (weather.wind > 25) { risks.push("High dust risk from strong winds"); level = "Moderate"; color = "bg-warning/10 text-warning"; }
  if (weather.humidity < 30) { risks.push("Dry conditions may increase particulate matter"); level = "Moderate"; color = "bg-warning/10 text-warning"; }
  if (weather.tempHigh > 38) { risks.push("Extreme heat may cause ground-level ozone"); level = "Poor"; color = "bg-destructive/10 text-destructive"; }
  if (weather.humidity > 85 && weather.tempHigh > 30) { risks.push("Haze likely from high humidity and temperature"); }
  if (weather.wind < 5 && weather.humidity > 70) { risks.push("Stagnant air conditions may trap pollutants"); }

  return { level, color, risks };
}

function getHeatStress(temp: number, humidity: number) {
  const heatIndex = temp + 0.5 * (humidity - 50);
  if (heatIndex > 45) return { level: "Extreme", color: "text-destructive", advice: "Avoid outdoor work. Dangerous for humans and livestock." };
  if (heatIndex > 38) return { level: "High", color: "text-warning", advice: "Limit outdoor exposure. Ensure livestock have shade and water." };
  if (heatIndex > 30) return { level: "Moderate", color: "text-secondary", advice: "Take regular breaks. Monitor livestock hydration." };
  return { level: "Low", color: "text-success", advice: "Comfortable conditions for field work and livestock." };
}

function getTurbulenceRisk(wind: number, tempHigh: number) {
  if (wind > 30 || (wind > 20 && tempHigh > 35)) return { level: "High", color: "text-destructive" };
  if (wind > 15) return { level: "Moderate", color: "text-warning" };
  return { level: "Low", color: "text-success" };
}

export default function EnvironmentalMonitor() {
  const { position, loading: geoLoading } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const weather = forecast[0];

  const airQuality = getAirQualityInference(weather);
  const heatStress = weather ? getHeatStress(weather.tempHigh, weather.humidity) : null;
  const turbulence = weather ? getTurbulenceRisk(weather.wind, weather.tempHigh) : null;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Environmental Monitor</h1>
        <p className="text-sm text-muted-foreground">{position.locationName}</p>
      </div>

      {!weather ? (
        <div className="text-center py-12 text-muted-foreground">Loading environmental data...</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Air Quality */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wind className="h-4 w-4" /> Air Quality Inference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={`${airQuality.color} mb-3`}>{airQuality.level}</Badge>
              {airQuality.risks.length > 0 ? (
                <ul className="space-y-1.5">
                  {airQuality.risks.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No significant air quality concerns detected.</p>
              )}
            </CardContent>
          </Card>

          {/* Heat Stress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Thermometer className="h-4 w-4" /> Heat Stress Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              {heatStress && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={heatStress.color}>{heatStress.level}</Badge>
                    <span className="text-sm">{weather.tempHigh}°C / {weather.humidity}% humidity</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{heatStress.advice}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Turbulence Risk */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" /> Turbulence & Visibility
              </CardTitle>
            </CardHeader>
            <CardContent>
              {turbulence && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={turbulence.color}>Turbulence: {turbulence.level}</Badge>
                    <span className="text-sm">{weather.wind} km/h wind</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {weather.wind > 25
                      ? "Strong winds reduce visibility and create turbulence. Chemical spraying not recommended."
                      : weather.wind > 15
                        ? "Moderate winds may affect precision spraying and drone operations."
                        : "Calm conditions suitable for all field and aerial operations."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Precipitation Outlook */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CloudRain className="h-4 w-4" /> Precipitation & Flood Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={weather.rainProb > 70 ? "text-destructive" : weather.rainProb > 40 ? "text-warning" : "text-success"}>
                  {weather.rainProb}% Rain Probability
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {weather.rainProb > 70
                  ? "High rainfall expected. Risk of waterlogging and flash floods in low-lying areas. Delay planting and chemical applications."
                  : weather.rainProb > 40
                    ? "Moderate rainfall expected. Monitor drainage systems and plan field activities accordingly."
                    : "Low rainfall probability. Consider irrigation scheduling if soil moisture is low."}
              </p>
            </CardContent>
          </Card>

          {/* 3-Day Environmental Outlook */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Droplets className="h-4 w-4" /> 3-Day Environmental Outlook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {forecast.slice(0, 3).map((day, i) => {
                  const hs = getHeatStress(day.tempHigh, day.humidity);
                  return (
                    <div key={i} className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-xs font-medium mb-2">{day.day}</p>
                      <p className="text-lg font-bold">{day.tempHigh}°C</p>
                      <p className="text-xs text-muted-foreground">{day.wind} km/h wind</p>
                      <p className="text-xs text-muted-foreground">{day.rainProb}% rain</p>
                      <Badge variant="outline" className={`text-[10px] mt-2 ${hs.color}`}>
                        Heat: {hs.level}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
