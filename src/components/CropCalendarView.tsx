import { CropCalendarEntry } from "@/data/mock-data";

const colorMap: Record<string, string> = {
  earth: "bg-earth",
  primary: "bg-primary",
  secondary: "bg-secondary",
  warning: "bg-warning",
  success: "bg-success",
};

export function CropCalendarView({ calendar }: { calendar: CropCalendarEntry }) {
  const maxWeek = 20;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        {calendar.crop === "Maize" && "🌽"}
        {calendar.crop === "Rice" && "🌾"}
        {calendar.crop === "Cassava" && "🥔"}
        {calendar.crop}
      </h3>
      <div className="space-y-2">
        {calendar.activities.map((activity) => {
          const left = ((activity.startWeek - 1) / maxWeek) * 100;
          const width =
            ((activity.endWeek - activity.startWeek + 1) / maxWeek) * 100;

          return (
            <div key={activity.name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                {activity.name}
              </span>
              <div className="flex-1 relative h-6 rounded bg-muted overflow-hidden">
                <div
                  className={`absolute top-0 h-full rounded ${colorMap[activity.color] || "bg-primary"} flex items-center justify-center`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="text-[10px] font-medium text-primary-foreground truncate px-1">
                    Wk {activity.startWeek}-{activity.endWeek}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Weeks 1–{maxWeek} of major rain season
      </p>
    </div>
  );
}
