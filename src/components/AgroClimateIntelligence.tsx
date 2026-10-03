import { AlertTriangle, CalendarClock, CheckCircle2, CloudRain, Droplets, Leaf, ShieldAlert, ThermometerSun, Wind } from "lucide-react";
import type { WeatherDay } from "@/data/mock-data";

type Severity = "Informational" | "Advisory" | "Watch" | "Warning" | "Critical";
type Confidence = "Low" | "Moderate" | "High";

interface ProactiveAlert {
  id: string;
  type: string;
  severity: Severity;
  confidence: Confidence;
  horizon: string;
  explanation: string;
  action: string;
}

const severityStyle: Record<Severity, string> = {
  Informational: "border-accent/40 bg-accent/5 text-accent",
  Advisory: "border-primary/40 bg-primary/5 text-primary",
  Watch: "border-warning/40 bg-warning/5 text-warning",
  Warning: "border-secondary/50 bg-secondary/5 text-secondary",
  Critical: "border-destructive/50 bg-destructive/5 text-destructive",
};

function formatTimestamp(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function confidenceFor(day: WeatherDay, isLive: boolean): Confidence {
  if (!isLive) return "Low";
  return day.isoDate ? "High" : "Moderate";
}

function buildAlerts(forecast: WeatherDay[], isLive: boolean): ProactiveAlert[] {
  if (!isLive || forecast.length === 0) return [];
  const alerts: ProactiveAlert[] = [];
  forecast.forEach((day, index) => {
    const horizon = index === 0 ? "Today" : `${day.day}, ${day.date}`;
    const confidence = confidenceFor(day, isLive);
    if (day.rainProb >= 80) {
      alerts.push({
        id: `rain-${day.isoDate ?? index}`,
        type: "Rainfall & drainage",
        severity: day.rainProb >= 90 ? "Critical" : "Warning",
        confidence,
        horizon,
        explanation: `The forecast suggests a ${day.rainProb}% chance of rain${typeof day.rainMm === "number" ? ` and about ${day.rainMm} mm accumulation` : ""}. Saturated or low-lying fields may face increased waterlogging risk.`,
        action: "Inspect drainage channels, protect stored produce, and monitor local conditions.",
      });
    }
    if (day.tempHigh >= 35) {
      alerts.push({
        id: `heat-${day.isoDate ?? index}`,
        type: "Heat stress",
        severity: day.tempHigh >= 39 ? "Critical" : "Watch",
        confidence,
        horizon,
        explanation: `Conditions indicate a forecast high of ${day.tempHigh}°C, which may increase crop, livestock, and worker heat stress.`,
        action: "Consider early irrigation, reliable shade and water access, and reduced midday field activity.",
      });
    }
    if (day.wind >= 25) {
      alerts.push({
        id: `wind-${day.isoDate ?? index}`,
        type: "Wind operations",
        severity: day.wind >= 35 ? "Warning" : "Watch",
        confidence,
        horizon,
        explanation: `Forecast wind of ${day.wind} km/h may affect spraying, light structures, and aerial operations.`,
        action: "Secure exposed equipment and reassess spraying or flight plans near the forecast period.",
      });
    }
    if (day.humidity >= 85 && day.tempHigh >= 28) {
      alerts.push({
        id: `humidity-${day.isoDate ?? index}`,
        type: "Crop disease conditions",
        severity: "Advisory",
        confidence,
        horizon,
        explanation: `Warm conditions with humidity near ${day.humidity}% may increase fungal disease pressure; this is a risk signal, not a diagnosis.`,
        action: "Monitor leaves and stems, improve airflow where practical, and avoid unnecessary overhead watering.",
      });
    }
  });
  return alerts.slice(0, 5);
}

export function AgroClimateIntelligence({
  forecast,
  location,
  isLive,
  loading,
  observedAt,
  lastUpdated,
}: {
  forecast: WeatherDay[];
  location: string;
  isLive: boolean;
  loading: boolean;
  observedAt: Date | null;
  lastUpdated: Date | null;
}) {
  const alerts = buildAlerts(forecast, isLive);
  const today = forecast[0];
  const timestamp = observedAt ?? lastUpdated;
  const maxRain = forecast.length ? Math.max(...forecast.map((day) => day.rainProb)) : null;
  const maxTemp = forecast.length ? Math.max(...forecast.map((day) => day.tempHigh)) : null;
  const maxWind = forecast.length ? Math.max(...forecast.map((day) => day.wind)) : null;
  const condition = alerts.some((alert) => alert.severity === "Critical")
    ? "Action required"
    : alerts.some((alert) => alert.severity === "Warning")
      ? "Elevated conditions"
      : alerts.length > 0
        ? "Monitor conditions"
        : "No significant risk detected";

  if (loading && !today) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Loading current climate intelligence…</div>;
  }

  if (!today || !isLive) {
    return (
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="font-bold">AgroClimate Intelligence</h2>
            <p className="mt-1 text-sm text-muted-foreground">Insufficient current data for a reliable risk assessment.</p>
            <p className="mt-2 text-xs text-muted-foreground">Last successful update: {formatTimestamp(lastUpdated)}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-y bg-card py-5 sm:border sm:p-5 sm:rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">AgroClimate Intelligence</p>
            <h2 className="mt-1 text-xl font-bold">{condition}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Decision outlook for {location} from current conditions and the seven-day forecast.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-4 w-4" /> Data timestamp: {formatTimestamp(timestamp)}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
          {[
            { label: "Climate", value: `${today.tempHigh}°C now outlook`, Icon: ThermometerSun },
            { label: "Agriculture", value: maxRain !== null ? `${maxRain}% peak rain chance` : "Unavailable", Icon: Leaf },
            { label: "Environment", value: maxTemp !== null ? `${maxTemp}°C weekly high` : "Unavailable", Icon: CloudRain },
            { label: "Operations", value: maxWind !== null ? `${maxWind} km/h peak wind` : "Unavailable", Icon: Wind },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-card p-3">
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Proactive Alerts</h2>
            <p className="text-xs text-muted-foreground">Forecast probability becomes an alert only when a risk threshold is met.</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{alerts.length} active</span>
        </div>
        {alerts.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-semibold">No significant risk detected</p>
              <p className="mt-1 text-xs text-muted-foreground">Current weather thresholds do not justify a proactive warning. Continue routine monitoring.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <article key={alert.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold">{alert.type}</h3>
                  </div>
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <span className={`rounded border px-2 py-0.5 ${severityStyle[alert.severity]}`}>{alert.severity}</span>
                    <span className="rounded border bg-muted px-2 py-0.5 text-muted-foreground">{alert.confidence} confidence</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-[120px_1fr]">
                  <div className="text-muted-foreground"><p>{location}</p><p className="mt-1 font-medium text-foreground">{alert.horizon}</p></div>
                  <div><p className="text-muted-foreground">{alert.explanation}</p><p className="mt-2 font-medium">Recommended: {alert.action}</p></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function ForecastTimestamp({ day }: { day: WeatherDay }) {
  const date = day.isoDate ? new Date(day.isoDate) : null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <Droplets className="h-3 w-3" /> Forecast period: {date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : day.date}
    </span>
  );
}