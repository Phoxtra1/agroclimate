import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { weeklyForecast } from "@/data/mock-data";
import { ArrowLeft, Droplets, Thermometer, Wind } from "lucide-react";
import { Link } from "react-router-dom";

export default function Weather() {
  const today = weeklyForecast[0];

  return (
    <div className="pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Weather Forecast</h1>
      </header>

      <div className="px-4 space-y-5">
        <TodayWeather weather={today} />

        {/* Detail stats */}
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

        {/* Full 7-day */}
        <section>
          <h2 className="font-bold mb-3">7-Day Outlook</h2>
          <div className="bg-card rounded-xl p-4 shadow-sm">
            {weeklyForecast.map((day) => (
              <ForecastRow key={day.day} day={day} />
            ))}
          </div>
        </section>

        {/* Farmer tip */}
        <div className="bg-primary/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary">💡 Farmer Tip</p>
          <p className="text-sm text-muted-foreground mt-1">
            Heavy rain is expected on Sunday–Monday. Complete land preparation
            by Saturday to take advantage of the moisture for planting.
          </p>
        </div>
      </div>
    </div>
  );
}
