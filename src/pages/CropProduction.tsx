// Copy this file to your other project's component folder
// Requires: src/data/agro-data.ts (see src/reference/agro-data.ts)

import { useState } from "react";
import { cropCategories, getCurrentSeason } from "@/data/agro-data";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CropProduction() {
  const [activeCategory, setActiveCategory] = useState("cash");
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);
  const category = cropCategories.find((c) => c.id === activeCategory)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Crop Production</h1>
            <Badge variant="secondary" className="text-xs">
              {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Recommended crops for the current season in your area
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {cropCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setExpandedCrop(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{category.description}</p>

        {/* Crop list */}
        <div className="space-y-3">
          {category.crops.map((crop) => {
            const isExpanded = expandedCrop === crop.name;
            return (
              <div
                key={crop.name}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedCrop(isExpanded ? null : crop.name)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{crop.icon}</span>
                    <div>
                      <p className="font-semibold text-foreground">{crop.name}</p>
                      <p className="text-xs text-muted-foreground">
                        🌱 Plant: {crop.plantingSeason}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {crop.irrigationNeeded && (
                      <Badge variant="outline" className="text-xs">
                        💧 Irrigation
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">🌱 Planting</p>
                        <p className="text-sm font-medium">{crop.plantingSeason}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">🫛 Harvest</p>
                        <p className="text-sm font-medium">{crop.harvestSeason}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">🌧️ Rainfall</p>
                        <p className="text-sm font-medium">{crop.rainfall}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">💧 Irrigation</p>
                        <p className="text-sm font-medium">
                          {crop.irrigationNeeded
                            ? "Required / Recommended"
                            : "Rain-fed is sufficient"}
                        </p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">📊 Yield / ha</p>
                        <p className="text-sm font-medium">{crop.yieldPerHectare}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">🌡️ Temperature</p>
                        <p className="text-sm font-medium">{crop.temperatureRange}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg col-span-2">
                        <p className="text-xs text-muted-foreground">🪨 Soil Type</p>
                        <p className="text-sm font-medium">{crop.soilType}</p>
                      </div>
                    </div>

                    {/* Regions */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">📍 Best Regions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {crop.regions.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Tip */}
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">💡 Farmer Tip</p>
                      <p className="text-sm">{crop.tips}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
