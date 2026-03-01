import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { AlertCard } from "@/components/AlertCard";
import { AICropAdvisory } from "@/components/AICropAdvisory";
import { CropCalendarView } from "@/components/CropCalendarView";
import { cropCalendars } from "@/data/mock-data";
import { MapPin, ChevronRight, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useWeather } from "@/hooks/useWeather";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCropAdvisory } from "@/hooks/useCropAdvisory";
import { useProfile } from "@/hooks/useProfile";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import { AdvisoryCard } from "@/components/AdvisoryCard";

export default function Dashboard() {
  const { position, loading: geoLoading } = useGeolocation();
  const { forecast, loading: weatherLoading, isLive } = useWeather(position.lat, position.lon);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { advisory, loading: advisoryLoading, fetchAdvisory } = useCropAdvisory();
  const { unreadAlerts, markRead, dismiss } = useUserAlerts();

  // Dynamic advisory based on weather & location
  const dynamicAdvisory = {
    crop: (typeof advisory?.recommendedCrops?.[0] === "string" ? advisory.recommendedCrops[0] : advisory?.recommendedCrops?.[0]?.name) || "Your crops",
    region: position.locationName || "Your area",
    action: advisory?.weeklyActions?.[0] || getDynamicAction(forecast[0]),
    detail: getDynamicDetail(forecast[0], position.locationName),
    urgency: getDynamicUrgency(forecast[0]),
  };

  // Build display name
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Farmer";

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Akwaaba, {displayName} 👋</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3.5 w-3.5" />
            {geoLoading ? (
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Detecting location…</span>
            ) : (
              <span>{position.locationName}</span>
            )}
            {isLive ? (
              <span className="flex items-center gap-1 text-success text-xs"><Wifi className="h-3 w-3" /> Live</span>
            ) : (
              <span className="flex items-center gap-1 text-warning text-xs"><WifiOff className="h-3 w-3" /> Cached</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <TodayWeather weather={forecast[0]} />
          <AdvisoryCard {...dynamicAdvisory} />

          {/* 7-Day Forecast */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">7-Day Forecast</h2>
              <Link to="/weather" className="text-sm text-primary flex items-center gap-0.5">
                Details <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-sm">
              {forecast.slice(0, 4).map((day) => (
                <ForecastRow key={day.day} day={day} />
              ))}
            </div>
          </section>

          {/* Crop Calendar */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Crop Calendar</h2>
              <Link to="/calendar" className="text-sm text-primary flex items-center gap-0.5">
                Full view <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <CropCalendarView calendar={cropCalendars[0]} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* AI Crop Advisory */}
          <section>
            <h2 className="font-bold mb-3">🌱 AI Crop Advisory</h2>
            <AICropAdvisory
              advisory={advisory}
              loading={advisoryLoading}
              onRefresh={() => fetchAdvisory(forecast[0], position.locationName, position)}
            />
          </section>

          {unreadAlerts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold">New Alerts</h2>
                <Link to="/alerts" className="text-sm text-primary flex items-center gap-0.5">
                  View all <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {unreadAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onMarkRead={() => markRead(alert.id)}
                    onDismiss={() => dismiss(alert.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function getDynamicAction(weather: any): string {
  if (!weather) return "Check your crops today";
  if (weather.rainProb > 60) return "Prepare drainage — rain expected";
  if (weather.rainProb > 30) return "Good time for planting — moisture coming";
  if (weather.tempHigh > 35) return "Irrigate crops — high heat expected";
  if (weather.humidity > 80) return "Monitor for fungal diseases";
  return "Inspect fields and plan next activities";
}

function getDynamicDetail(weather: any, location: string): string {
  if (!weather) return `Stay updated with real-time weather in ${location}.`;
  if (weather.rainProb > 60) return `Heavy rain likely in ${location} (${weather.rainProb}% chance). Ensure drainage channels are clear to prevent waterlogging.`;
  if (weather.rainProb > 30) return `Moderate rain expected in ${location}. Soil moisture will be ideal for planting or transplanting.`;
  if (weather.tempHigh > 35) return `High temperatures of ${weather.tempHigh}°C expected in ${location}. Water crops early morning or late evening.`;
  return `Current conditions in ${location}: ${weather.description}, ${weather.tempHigh}°C. Good conditions for field work.`;
}

function getDynamicUrgency(weather: any): "high" | "medium" | "low" {
  if (!weather) return "low";
  if (weather.rainProb > 70 || weather.tempHigh > 38) return "high";
  if (weather.rainProb > 40 || weather.tempHigh > 35) return "medium";
  return "low";
}
