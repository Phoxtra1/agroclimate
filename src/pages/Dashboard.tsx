import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { AlertCard } from "@/components/AlertCard";
import { AdvisoryCard } from "@/components/AdvisoryCard";
import { CropCalendarView } from "@/components/CropCalendarView";
import { alerts, todayAdvisory, cropCalendars } from "@/data/mock-data";
import { MapPin, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useWeather } from "@/hooks/useWeather";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { forecast, loading: weatherLoading, isLive } = useWeather();
  const { user } = useAuth();
  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Welcome back</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3.5 w-3.5" />
            <span>Ashanti Region, Ghana</span>
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
          <AdvisoryCard {...todayAdvisory} />

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
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
