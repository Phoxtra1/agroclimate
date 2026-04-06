import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { AlertCard } from "@/components/AlertCard";
import { AICropAdvisory } from "@/components/AICropAdvisory";
import { CropCalendarView } from "@/components/CropCalendarView";
import { AdvisoryCard } from "@/components/AdvisoryCard";
import { cropCalendars } from "@/data/mock-data";
import { MapPin, ChevronRight, Wifi, WifiOff, Loader2, Fish, Package, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useWeather } from "@/hooks/useWeather";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCropAdvisory } from "@/hooks/useCropAdvisory";
import { useProfile } from "@/hooks/useProfile";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import { Button } from "@/components/ui/button";
import { DashboardHeaderMenu } from "@/components/DashboardHeaderMenu";

export default function Dashboard() {
  const { position, loading: geoLoading } = useGeolocation();
  const { forecast, loading: weatherLoading, isLive } = useWeather(position.lat, position.lon);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { advisory, loading: advisoryLoading, fetchAdvisory } = useCropAdvisory();
  const { unreadAlerts, alerts, markRead, dismiss } = useUserAlerts(forecast, position.locationName);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Farmer";

  const dynamicAdvisory = {
    crop: (typeof advisory?.recommendedCrops?.[0] === "string" ? advisory.recommendedCrops[0] : advisory?.recommendedCrops?.[0]?.name) || "Your crops",
    region: position.locationName || "Your area",
    action: advisory?.weeklyActions?.[0] || getDynamicAction(forecast[0]),
    detail: getDynamicDetail(forecast[0], position.locationName),
    urgency: getDynamicUrgency(forecast[0]),
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header with menu */}
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
        <DashboardHeaderMenu unreadCount={unreadAlerts.length} />
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
        <div className="space-y-6">
          {/* 1. AI Crop Advisory */}
          <section>
            <h2 className="font-bold mb-3">🌱 AI Crop Advisory</h2>
            <AICropAdvisory
              advisory={advisory}
              loading={advisoryLoading}
              onRefresh={() => fetchAdvisory(forecast[0], position.locationName, position)}
            />
          </section>

          {/* 2. Aquaculture Monitoring */}
          <section className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Fish className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">Aquaculture Monitoring</h2>
              </div>
              <Link to="/aquaculture" className="text-xs text-primary font-medium hover:underline">
                View Ponds
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Real-time monitoring of water quality and feeding schedules.
            </p>
            <Link to="/aquaculture">
              <Button size="sm" variant="outline" className="w-full text-xs h-8 border-primary/20">
                Pond Status
              </Button>
            </Link>
          </section>

          {/* 3. Agro Inventory */}
          <section className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">Agro Inventory</h2>
              </div>
              <Link to="/inventory" className="text-xs text-primary font-medium hover:underline">
                Manage
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Track seeds, fertilizers, and equipment stock levels.
            </p>
            <Link to="/inventory">
              <Button size="sm" variant="outline" className="w-full text-xs h-8 border-primary/20">
                Open Inventory <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </Link>
          </section>

          {/* Alerts */}
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

// Helper functions (remain unchanged)
function getDynamicAction(weather: any): string {
  if (!weather) return "Check crops";
  if (weather.rainProb > 60) return "Prepare drainage";
  return "Inspect fields";
}

function getDynamicDetail(weather: any, location: string): string {
  return `Conditions in ${location}: ${weather?.description || 'updated'}.`;
}

function getDynamicUrgency(weather: any): "high" | "medium" | "low" {
  return "low";
}
