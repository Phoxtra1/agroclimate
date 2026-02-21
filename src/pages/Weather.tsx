import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { useWeather } from "@/hooks/useWeather";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getCurrentSeason, getSeasonalRecommendations, cropCategories } from "@/data/agro-data";
import { Droplets, Thermometer, Wind, MapPin, Sprout, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Weather() {
  const { position } = useGeolocation();
  const { forecast, isLive } = useWeather(position.lat, position.lon);
  const today = forecast[0];
  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);
  const recommendations = getSeasonalRecommendations(currentMonth);

  // Check if irrigation is needed based on weather
  const avgRain = forecast.reduce((s, d) => s + d.rainProb, 0) / forecast.length;
  const irrigationNeeded = avgRain < 30 || season.type === "dry";

  // Find crops suitable for the current season in the user's region
  const suitableCrops = cropCategories.flatMap((cat) =>
    cat.crops
      .filter((c) => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = monthNames[currentMonth - 1];
        return c.plantingSeason.includes(m) || c.plantingSeason.includes("Year-round");
      })
      .map((c) => ({ ...c, category: cat.name }))
  ).slice(0, 8);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Weather & Agro Forecast</h1>
        <Badge variant="outline" className="text-xs">
          {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
        </Badge>
      </div>

      {/* Location details */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <MapPin className="h-3.5 w-3.5" />
        <span className="font-medium">{position.community || position.locationName}</span>
        {position.district && <span>• {position.district}</span>}
        {position.region && <span>• {position.region}</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <TodayWeather weather={today} />

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl p-4 text-center shadow-sm">
              <Droplets className="h-5 w-5 mx-auto text-accent" />
              <p className="text-lg font-bold mt-2">{today.humidity}%</p>
              <p className="text-xs text-muted-foreground">Humidity</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center shadow-sm">
              <Wind className="h-5 w-5 mx-auto text-accent" />
              <p className="text-lg font-bold mt-2">{today.wind} km/h</p>
              <p className="text-xs text-muted-foreground">Wind</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center shadow-sm">
              <Thermometer className="h-5 w-5 mx-auto text-accent" />
              <p className="text-lg font-bold mt-2">{today.tempLow}°</p>
              <p className="text-xs text-muted-foreground">Low</p>
            </div>
          </div>

          {/* Irrigation Advisory */}
          {irrigationNeeded && (
            <div className="bg-warning/10 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Irrigation Support Recommended</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Low rainfall expected this week ({Math.round(avgRain)}% avg rain probability). 
                  Crops requiring water — especially vegetables, rice, and young seedlings — will need supplemental irrigation.
                  Consider drip irrigation for water efficiency.
                </p>
              </div>
            </div>
          )}

          <section>
            <h2 className="font-bold mb-3">7-Day Outlook</h2>
            <div className="bg-card rounded-xl p-4 shadow-sm">
              {forecast.map((day) => (
                <ForecastRow key={day.day} day={day} />
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar: Agro production info */}
        <div className="space-y-5">
          {/* Crops to plant now */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
              <Sprout className="h-4 w-4 text-primary" /> Plant This Season
            </h3>
            <div className="space-y-2">
              {suitableCrops.map((crop) => (
                <div key={crop.name} className="flex items-center gap-2 text-xs">
                  <span className="text-base">{crop.icon}</span>
                  <div className="flex-1">
                    <span className="font-medium">{crop.name}</span>
                    <span className="text-muted-foreground ml-1.5">({crop.category})</span>
                  </div>
                  {crop.irrigationNeeded && <Droplets className="h-3 w-3 text-accent" />}
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Recommendations */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm mb-3">📋 Seasonal Actions</h3>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span> {rec}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-primary">💡 Farmer Tip</p>
            <p className="text-sm text-muted-foreground mt-1">
              {irrigationNeeded
                ? "This is the dry season. Focus on irrigated crops like tomato, onion, and cabbage for good income. Mulch to conserve soil moisture."
                : "Rainy season is here! Plant your major crops now. Prepare drainage channels to prevent waterlogging."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
