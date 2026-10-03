import { WeatherDay } from "@/data/mock-data";

export function TodayWeather({ weather }: { weather: WeatherDay }) {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="rounded-xl bg-gradient-to-br from-sky to-accent p-5 text-accent-foreground">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Today's Weather</p>
          <p className="text-xs opacity-70">{dayName}, {monthDay}</p>
          <p className="text-4xl font-bold mt-1">{weather.tempHigh}°C</p>
          <p className="text-sm opacity-90 mt-1">{weather.description}</p>
        </div>
        <span className="text-6xl">{weather.icon}</span>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span>💧</span>
          <span>Rain: {weather.rainProb}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🌡️</span>
          <span>Low: {weather.tempLow}°C</span>
        </div>
        <div className="flex items-center gap-1">
          <span>💨</span>
          <span>{weather.wind} km/h</span>
        </div>
      </div>
    </div>
  );
}

export function ForecastRow({ day }: { day: WeatherDay }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="w-20">
        <p className="font-semibold text-sm">{day.day}</p>
        <p className="text-[11px] text-muted-foreground">{day.date}</p>
      </div>
      <span className="text-2xl">{day.icon}</span>
      <div className="text-right text-sm">
        <p className="font-semibold text-sm">{day.tempHigh}° / {day.tempLow}°</p>
        <p className="text-muted-foreground text-xs flex items-center gap-1 justify-end">
          <span className="text-sky-400">💧</span> {day.rainProb}%
        </p>
      </div>
    </div>
  );
}
