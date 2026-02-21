import { useState } from "react";
import { livestockCategories, getCurrentSeason } from "@/data/agro-data";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Livestock() {
  const [activeCategory, setActiveCategory] = useState("poultry");
  const [expandedAnimal, setExpandedAnimal] = useState<string | null>(null);
  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);

  const category = livestockCategories.find((c) => c.id === activeCategory)!;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Livestock & Animal Rearing</h1>
        <Badge variant="outline" className="text-xs">
          {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Seasonal guidelines for poultry, ruminants, pigs, and fish farming
      </p>

      {/* Category tabs */}
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

      {/* Animal list */}
      <div className="space-y-3">
        {category.animals.map((animal) => {
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
                    <p className="text-xs text-muted-foreground">🗓️ Best: {animal.bestSeason}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border">
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div>
                      <p className="font-medium text-muted-foreground">🗓️ Best Season</p>
                      <p>{animal.bestSeason}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">💕 Breeding</p>
                      <p>{animal.breedingSeason}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">🏠 Housing</p>
                      <p>{animal.housing}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">🍽️ Feeding</p>
                      <p>{animal.feeding}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Common Breeds</p>
                    <div className="flex flex-wrap gap-1">
                      {animal.commonBreeds.map((b) => (
                        <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
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
        })}
      </div>
    </div>
  );
}
