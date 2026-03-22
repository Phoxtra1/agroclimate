import { useState } from "react";
import { livestockCategories, getCurrentSeason } from "@/data/agro-data";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const africaCountries = [
  "Ghana",
  "Nigeria",
  "Burkina Faso",
  "Senegal",
  "South Africa",
  "Kenya",
  "Uganda",
  "Egypt",
  "Morocco",
  "Tanzania",
  // Add all countries you want
];

// Map countries to generalized regions in your data
const countryRegionMap: Record<string, string> = {
  "Ghana": "West Africa",
  "Nigeria": "West Africa",
  "Burkina Faso": "Sahel",
  "Senegal": "Sahel",
  "Kenya": "East Africa",
  "Uganda": "East Africa",
  "South Africa": "Southern Africa",
  "Egypt": "North Africa",
  "Morocco": "North Africa",
  "Tanzania": "East Africa",
};

export default function Livestock() {
  const [activeCategory, setActiveCategory] = useState("cattle");
  const [expandedAnimal, setExpandedAnimal] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("Ghana");

  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);

  const category = livestockCategories.find((c) => c.id === activeCategory)!;
  const userRegion = countryRegionMap[selectedCountry] ?? "All Africa";

  // Filter animals by the selected country region
  const filteredAnimals = category.animals.filter(a =>
    a.regions.includes(userRegion) || a.regions.includes("All Africa")
  );

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Livestock & Animal Rearing</h1>
        <Badge variant="outline" className="text-xs">
          {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Seasonal guidelines for cattle, goats, poultry, and more across Africa
      </p>

      {/* Country Selector */}
      <div className="mb-5">
        <label className="text-sm font-medium mr-2">Select your country:</label>
        <select
          value={selectedCountry}
          onChange={(e) => { setSelectedCountry(e.target.value); setExpandedAnimal(null); }}
          className="p-2 rounded border border-muted text-sm"
        >
          {africaCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {livestockCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setExpandedAnimal(null); }}
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

      {/* Animals List */}
      <div className="space-y-3">
        {filteredAnimals.length === 0 ? (
          <p className="p-4 text-muted-foreground">No livestock data available for {selectedCountry}</p>
        ) : (
          filteredAnimals.map((animal) => {
            const isExpanded = expandedAnimal === animal.name;
            return (
              <div key={animal.name} className="bg-card rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedAnimal(isExpanded ? null : animal.name)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{animal.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{animal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        🗓️ Best: {animal.bestSeason ?? "N/A"}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <p className="font-medium text-muted-foreground">🗓️ Best Season</p>
                        <p>{animal.bestSeason ?? "N/A"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">💕 Breeding</p>
                        <p>{animal.breedingSeason ?? "N/A"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">🏠 Housing</p>
                        <p>{animal.housing ?? "N/A"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">🍽️ Feeding</p>
                        <p>{animal.feeding ?? "N/A"}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Common Regions</p>
                      <div className="flex flex-wrap gap-1">
                        {animal.regions.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 bg-primary/10 rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary">💡 Advisory</p>
                      <p className="text-xs text-muted-foreground mt-1">{animal.tips}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
