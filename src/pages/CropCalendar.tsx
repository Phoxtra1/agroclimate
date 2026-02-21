import { CropCalendarView } from "@/components/CropCalendarView";
import { cropCalendars } from "@/data/mock-data";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function CropCalendar() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Crop Calendars</h1>
      </header>

      <div className="px-4 space-y-5">
        {/* Crop selector */}
        <div className="flex gap-2">
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

        {/* Calendar view */}
        <div className="bg-card rounded-xl p-5 shadow-sm">
          <CropCalendarView calendar={cropCalendars[selected]} />
        </div>

        {/* Legend */}
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Activity Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-earth" /> Land Preparation
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-primary" /> Planting
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-secondary" /> Fertilizer
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-warning" /> Weeding
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-success" /> Harvest
            </div>
          </div>
        </div>

        <div className="bg-primary/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary">📅 Season Info</p>
          <p className="text-sm text-muted-foreground mt-1">
            Showing major rain season calendar for Ashanti Region. Calendars
            adjust based on your location and season type.
          </p>
        </div>
      </div>
    </div>
  );
}
