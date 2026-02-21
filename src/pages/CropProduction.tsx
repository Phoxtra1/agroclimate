import { useState } from "react";
import { cropCategories, getCurrentSeason } from "@/data/agro-data";
import { Droplets, Sun, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CropProduction() {
  const [activeCategory, setActiveCategory] = useState("cash");
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);
  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);

  const category = cropCategories.find((c) => c.id === activeCategory)!;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Crop Production</h1>
        <Badge variant="outline" className="text-xs">
          {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Recommended crops for the current season in your area
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {cropCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setExpandedCrop(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span>{cat.icon}</span> {cat.name}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{category.description}</p>

      {/* Crop list */}
      <div className="space-y-3">
        {category.crops.map((crop) => {
          const isExpanded = expandedCrop === crop.name;
          return (
            <div key={crop.name} className="bg-card rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedCrop(isExpanded ? null : crop.name)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{crop.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{crop.name}</p>
                    <p className="text-xs text-muted-foreground">🌱 Plant: {crop.plantingSeason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {crop.irrigationNeeded && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Droplets className="h-3 w-3" /> Irrigation
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border">
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <p className="font-medium text-muted-foreground">🌱 Planting</p>
                      <p>{crop.plantingSeason}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">🫛 Harvest</p>
                      <p>{crop.harvestSeason}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">🌧️ Rainfall</p>
                      <p>{crop.rainfall}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">💧 Irrigation</p>
                      <p>{crop.irrigationNeeded ? "Required / Recommended" : "Rain-fed is sufficient"}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1"><MapPin className="h-3 w-3 inline" /> Best Regions</p>
                    <div className="flex flex-wrap gap-1">
                      {crop.regions.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 bg-primary/10 rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary">💡 Farmer Tip</p>
                    <p className="text-xs text-muted-foreground mt-1">{crop.tips}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
