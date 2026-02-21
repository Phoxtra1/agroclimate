import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { useWeather } from "@/hooks/useWeather";
import { Droplets, Thermometer, Wind } from "lucide-react";

export default function Weather() {
  const { forecast, isLive } = useWeather();
  const today = forecast[0];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Weather Forecast</h1>

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

          <section>
            <h2 className="font-bold mb-3">7-Day Outlook</h2>
            <div className="bg-card rounded-xl p-4 shadow-sm">
              {forecast.map((day) => (
                <ForecastRow key={day.day} day={day} />
              ))}
            </div>
          </section>
        </div>

        <div>
          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-primary">💡 Farmer Tip</p>
            <p className="text-sm text-muted-foreground mt-1">
              Heavy rain is expected soon. Complete land preparation to take advantage of the moisture for planting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
