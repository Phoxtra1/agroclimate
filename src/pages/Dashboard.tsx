import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { AlertCard } from "@/components/AlertCard";
import { AdvisoryCard } from "@/components/AdvisoryCard";
import { CropCalendarView } from "@/components/CropCalendarView";
import { weeklyForecast, alerts, todayAdvisory, cropCalendars } from "@/data/mock-data";
import { MapPin, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <div className="pb-20 max-w-lg mx-auto">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AgroClimate</h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>Ashanti Region, Ghana</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            KA
          </div>
        </div>
      </header>

      <div className="px-4 space-y-5">
        {/* Today's Weather */}
        <TodayWeather weather={weeklyForecast[0]} />

        {/* Advisory */}
        <AdvisoryCard {...todayAdvisory} />

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
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </section>
        )}

        {/* 7-Day Forecast Preview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">7-Day Forecast</h2>
            <Link to="/weather" className="text-sm text-primary flex items-center gap-0.5">
              Details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm">
            {weeklyForecast.slice(0, 4).map((day) => (
              <ForecastRow key={day.day} day={day} />
            ))}
          </div>
        </section>

        {/* Crop Calendar Snapshot */}
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
    </div>
  );
}
