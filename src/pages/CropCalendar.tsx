import { CropCalendarView } from "@/components/CropCalendarView";
import { cropCalendars } from "@/data/mock-data";
import { useState } from "react";

export default function CropCalendar() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Crop Calendars</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex gap-2 flex-wrap">
            {cropCalendars.map((cal, i) => (
              <button
                key={cal.crop}
                onClick={() => setSelected(i)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selected === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {cal.crop}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-xl p-5 shadow-sm">
            <CropCalendarView calendar={cropCalendars[selected]} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-3">Activity Legend</h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-earth" /> Land Preparation</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-primary" /> Planting</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-secondary" /> Fertilizer</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning" /> Weeding</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success" /> Harvest</div>
            </div>
          </div>

          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-primary">📅 Season Info</p>
            <p className="text-sm text-muted-foreground mt-1">
              Showing major rain season calendar for Ashanti Region. Calendars adjust based on your location and season type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
