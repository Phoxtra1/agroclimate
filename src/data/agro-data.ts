// Comprehensive agricultural data for West Africa

export interface CropInfo {
  name: string;
  icon: string;
  plantingSeason: string;
  harvestSeason: string;
  rainfall: string;
  irrigationNeeded: boolean;
  regions: string[];
  tips: string;
}

export interface CropCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  crops: CropInfo[];
}

export interface LivestockInfo {
  name: string;
  icon: string;
  bestSeason: string;
  breedingSeason: string;
  housing: string;
  feeding: string;
  commonBreeds: string[];
  tips: string;
}

export interface LivestockCategory {
  id: string;
  name: string;
  icon: string;
  animals: LivestockInfo[];
}

export const cropCategories: CropCategory[] = [
  {
    id: "cash",
    name: "Cash Crops",
    icon: "💰",
    description: "High-value export and industrial crops",
    crops: [
      { name: "Cocoa", icon: "🫘", plantingSeason: "Mar–Jun (major), Sep–Nov (minor)", harvestSeason: "Oct–Jan (main), May–Jul (mid)", rainfall: "1500–2000mm/yr", irrigationNeeded: false, regions: ["Ashanti", "Western", "Eastern", "Brong Ahafo"], tips: "Shade management is critical. Use plantain/banana as temporary shade." },
      { name: "Cashew", icon: "🥜", plantingSeason: "Jun–Aug", harvestSeason: "Feb–Apr", rainfall: "800–1200mm/yr", irrigationNeeded: false, regions: ["Northern", "Upper East", "Upper West", "Brong Ahafo"], tips: "Fire belts around plantations during dry season." },
      { name: "Oil Palm", icon: "🌴", plantingSeason: "Jun–Sep", harvestSeason: "Year-round (peak Jan–May)", rainfall: "1800–2500mm/yr", irrigationNeeded: false, regions: ["Western", "Eastern", "Ashanti", "Central"], tips: "Harvest every 10–14 days for best oil quality." },
      { name: "Rubber", icon: "🌳", plantingSeason: "Jun–Aug", harvestSeason: "Year-round (tapping from 5-7 years)", rainfall: "2000–2500mm/yr", irrigationNeeded: false, regions: ["Western", "Central"], tips: "Tapping should be done early morning when latex flow is highest." },
      { name: "Coconut", icon: "🥥", plantingSeason: "Jun–Sep", harvestSeason: "Year-round", rainfall: "1200–1800mm/yr", irrigationNeeded: true, regions: ["Greater Accra", "Volta", "Central", "Western"], tips: "Coastal areas are ideal. Young palms need regular watering." },
      { name: "Mango", icon: "🥭", plantingSeason: "Jun–Aug (transplanting)", harvestSeason: "Mar–Jul", rainfall: "600–1500mm/yr", irrigationNeeded: true, regions: ["Northern", "Upper East", "Volta", "Greater Accra"], tips: "Prune after harvest. Watch for fruit flies during fruiting." },
      { name: "Orange/Citrus", icon: "🍊", plantingSeason: "Jun–Aug", harvestSeason: "Nov–Mar", rainfall: "1000–1500mm/yr", irrigationNeeded: true, regions: ["Eastern", "Ashanti", "Volta"], tips: "Citrus greening disease is a major threat. Use certified nursery stock." },
      { name: "Shea", icon: "🌰", plantingSeason: "Wild/Jun–Aug (enrichment)", harvestSeason: "Jun–Sep (fruit)", rainfall: "600–1200mm/yr", irrigationNeeded: false, regions: ["Northern", "Upper East", "Upper West", "Savannah"], tips: "Protect wild shea trees. Fire management is essential." },
    ],
  },
  {
    id: "food",
    name: "Food Crops",
    icon: "🍽️",
    description: "Staple crops for food security",
    crops: [
      { name: "Maize", icon: "🌽", plantingSeason: "Mar–May (major), Aug–Sep (minor)", harvestSeason: "Jul–Aug (major), Nov–Dec (minor)", rainfall: "800–1200mm/yr", irrigationNeeded: false, regions: ["All regions"], tips: "Apply fertilizer at 3 weeks and 6 weeks after planting." },
      { name: "Rice", icon: "🌾", plantingSeason: "Apr–Jun (rain-fed), Year-round (irrigated)", harvestSeason: "Aug–Oct (rain-fed)", rainfall: "1200–1800mm/yr", irrigationNeeded: true, regions: ["Northern", "Upper East", "Volta", "Ashanti"], tips: "Transplant at 21 days for best results. Maintain water depth of 5cm." },
      { name: "Yam", icon: "🍠", plantingSeason: "Feb–Apr", harvestSeason: "Aug–Dec", rainfall: "1000–1500mm/yr", irrigationNeeded: false, regions: ["Brong Ahafo", "Northern", "Ashanti", "Eastern"], tips: "Mound preparation is key. Use seed yams of 200-300g for best yield." },
      { name: "Cassava", icon: "🥔", plantingSeason: "Mar–May or Sep–Oct", harvestSeason: "9-18 months after planting", rainfall: "800–1500mm/yr", irrigationNeeded: false, regions: ["All regions"], tips: "Very drought-tolerant. Harvest before the rains to reduce rot." },
      { name: "Plantain", icon: "🍌", plantingSeason: "Mar–Jun", harvestSeason: "9-12 months after planting", rainfall: "1500–2000mm/yr", irrigationNeeded: true, regions: ["Ashanti", "Eastern", "Western", "Brong Ahafo"], tips: "De-sucker regularly. Leave 2-3 suckers per mat for continuous harvest." },
      { name: "Cocoyam", icon: "🥕", plantingSeason: "Mar–May", harvestSeason: "Aug–Nov", rainfall: "1500–2000mm/yr", irrigationNeeded: false, regions: ["Ashanti", "Eastern", "Brong Ahafo"], tips: "Prefers shaded, moist areas. Good intercrop with cocoa." },
      { name: "Sorghum", icon: "🌾", plantingSeason: "Jun–Jul", harvestSeason: "Oct–Nov", rainfall: "600–1000mm/yr", irrigationNeeded: false, regions: ["Northern", "Upper East", "Upper West"], tips: "Bird damage is major issue at maturity. Use early-maturing varieties." },
      { name: "Millet", icon: "🌿", plantingSeason: "Jun–Jul", harvestSeason: "Sep–Oct", rainfall: "400–800mm/yr", irrigationNeeded: false, regions: ["Northern", "Upper East", "Upper West"], tips: "Most drought-tolerant cereal. Good for dry savanna zones." },
    ],
  },
  {
    id: "vegetables",
    name: "Vegetables",
    icon: "🥬",
    description: "Market garden and vegetable crops",
    crops: [
      { name: "Tomato", icon: "🍅", plantingSeason: "Aug–Oct (rain-fed), Nov–Mar (irrigated)", harvestSeason: "60-90 days after transplanting", rainfall: "600–1200mm/yr", irrigationNeeded: true, regions: ["Upper East", "Brong Ahafo", "Greater Accra", "Ashanti"], tips: "Stake plants for better yield. Watch for fruit worm and blight." },
      { name: "Pepper (Chili)", icon: "🌶️", plantingSeason: "Mar–May or Sep–Nov", harvestSeason: "70-90 days after transplanting", rainfall: "600–1200mm/yr", irrigationNeeded: true, regions: ["All regions"], tips: "Drip irrigation gives best results. Harvest when fully colored." },
      { name: "Onion", icon: "🧅", plantingSeason: "Oct–Dec (dry season)", harvestSeason: "Feb–Apr", rainfall: "Dry season crop", irrigationNeeded: true, regions: ["Upper East", "Northern", "Volta"], tips: "Requires full sun. Stop watering 2 weeks before harvest." },
      { name: "Okra", icon: "🟢", plantingSeason: "Mar–May or Sep–Oct", harvestSeason: "50-65 days after planting", rainfall: "800–1200mm/yr", irrigationNeeded: false, regions: ["All regions"], tips: "Harvest every 2-3 days for tender pods. Don't let pods over-mature." },
      { name: "Garden Egg", icon: "🍆", plantingSeason: "Mar–May or Sep–Nov", harvestSeason: "70-85 days after transplanting", rainfall: "800–1500mm/yr", irrigationNeeded: true, regions: ["All regions"], tips: "Popular in Ghanaian cuisine. Requires good drainage." },
      { name: "Cabbage", icon: "🥬", plantingSeason: "Sep–Nov", harvestSeason: "75-100 days after transplanting", rainfall: "Dry season crop", irrigationNeeded: true, regions: ["Greater Accra", "Eastern", "Ashanti"], tips: "Cool-season crop. Watch for diamondback moth and aphids." },
      { name: "Lettuce", icon: "🥗", plantingSeason: "Sep–Feb", harvestSeason: "45-60 days after planting", rainfall: "Dry season crop", irrigationNeeded: true, regions: ["Greater Accra", "Ashanti", "Eastern"], tips: "Grows best in cooler weather. Mulch to retain moisture." },
      { name: "Carrot", icon: "🥕", plantingSeason: "Oct–Dec", harvestSeason: "70-80 days after planting", rainfall: "Dry season crop", irrigationNeeded: true, regions: ["Ashanti", "Eastern", "Greater Accra"], tips: "Needs loose, sandy soil. Avoid stones that cause forking." },
    ],
  },
];

export const livestockCategories: LivestockCategory[] = [
  {
    id: "poultry",
    name: "Poultry",
    icon: "🐔",
    animals: [
      { name: "Broilers", icon: "🐓", bestSeason: "Year-round (peak demand Dec–Jan, Easter)", breedingSeason: "Year-round", housing: "Deep litter or raised platform. 0.1 sq m per bird.", feeding: "Starter (0-3 wks), Grower (3-6 wks), Finisher (6-8 wks)", commonBreeds: ["Cobb 500", "Ross 308", "Arbor Acres"], tips: "6-8 week cycle. Ensure proper ventilation. Vaccinate for Newcastle and Gumboro at days 7, 14, 21." },
      { name: "Layers", icon: "🥚", bestSeason: "Year-round (start rearing to hit peak lay in dry season)", breedingSeason: "Year-round", housing: "Deep litter or cage system. 0.2 sq m per bird.", feeding: "Starter, Grower, Layer mash with calcium supplement", commonBreeds: ["Lohmann Brown", "ISA Brown", "Hyline"], tips: "Start laying at 18-20 weeks. Provide 16 hours of light for maximum egg production." },
      { name: "Guinea Fowl", icon: "🐦", bestSeason: "Rainy season for natural hatching (Jun–Sep)", breedingSeason: "Apr–Sep (rainy season)", housing: "Semi-free range with night shelter.", feeding: "Free range with supplementary grains", commonBreeds: ["Pearl", "White", "Lavender"], tips: "Very hardy. Popular in Northern Ghana. Keets need warmth for first 4 weeks." },
    ],
  },
  {
    id: "ruminants",
    name: "Ruminants",
    icon: "🐐",
    animals: [
      { name: "Goats", icon: "🐐", bestSeason: "Year-round (breed in rainy for rainy-born kids with good pasture)", breedingSeason: "Year-round (peak rainy season)", housing: "Raised platform with good ventilation. 1-1.5 sq m per goat.", feeding: "Browse, forage, crop residues with mineral supplement", commonBreeds: ["West African Dwarf", "Sahelian", "Djallonké"], tips: "Deworm every 3 months. WAD goats are trypanotolerant and best for forest zones." },
      { name: "Sheep", icon: "🐑", bestSeason: "Year-round (high demand for festivals: Eid, Christmas)", breedingSeason: "Year-round", housing: "Raised pen or ground level with dry bedding. 1-1.5 sq m per sheep.", feeding: "Pasture, hay, crop residues, concentrate supplement", commonBreeds: ["Djallonké", "Nungua Blackhead", "Sahelian"], tips: "Djallonké sheep thrive in humid zones. Shear in dry season for hygiene." },
      { name: "Cattle", icon: "🐄", bestSeason: "Rainy season for calving (better pasture availability)", breedingSeason: "Year-round (mate in Oct–Dec for rainy season calving)", housing: "Paddock with shade. 6-10 sq m per head.", feeding: "Pasture, crop residues, agro-industrial by-products", commonBreeds: ["N'Dama (trypanotolerant)", "Sanga", "West African Shorthorn"], tips: "N'Dama breeds resist trypanosomiasis—ideal for tsetse zones. Rotate pastures." },
    ],
  },
  {
    id: "pigs",
    name: "Pig Farming",
    icon: "🐖",
    animals: [
      { name: "Pigs", icon: "🐷", bestSeason: "Year-round (avoid extreme heat; breed for market-ready by Dec)", breedingSeason: "Year-round (farrow every 5-6 months)", housing: "Concrete floor with shade, wallow area. 3-4 sq m per sow.", feeding: "Agro-industrial by-products, kitchen waste, formulated feed", commonBreeds: ["Large White", "Landrace", "Ashanti Black (local)"], tips: "Ashanti Black pigs are disease-resistant. Wallow or spray cooling in hot season. 10-12 piglets per litter." },
    ],
  },
  {
    id: "fish",
    name: "Fish Farming",
    icon: "🐟",
    animals: [
      { name: "Tilapia", icon: "🐟", bestSeason: "Year-round (stock at start of rainy season for pond filling)", breedingSeason: "Year-round in warm water (>25°C)", housing: "Earthen ponds (min 300 sq m), concrete tanks, cages", feeding: "Pelleted feed (28-35% protein). Feed 3-5% body weight/day.", commonBreeds: ["Nile Tilapia (Oreochromis niloticus)", "Akosombo strain"], tips: "Optimal temp 25-30°C. pH 6.5-8.5. Stock 3-5 fish per sq m. Harvest at 250-400g (6-8 months)." },
      { name: "Catfish", icon: "🐱", bestSeason: "Year-round (stock in rainy season)", breedingSeason: "Rainy season (induced breeding with hormones)", housing: "Concrete tanks, earthen ponds, flow-through systems", feeding: "Sinking pellets (35-42% protein). Feed 3-5% body weight/day.", commonBreeds: ["Clarias gariepinus", "Heterobranchus", "Hybrid (Heteroclarias)"], tips: "Tolerate low oxygen but provide aeration for best growth. Harvest at 800g-1.5kg (6-10 months)." },
    ],
  },
];

export function getCurrentSeason(month: number): { name: string; type: "dry" | "rainy" | "transition" } {
  // Ghana seasons (Southern)
  if (month >= 3 && month <= 6) return { name: "Major Rainy Season", type: "rainy" };
  if (month === 7 || month === 8) return { name: "Minor Dry Period", type: "dry" };
  if (month >= 9 && month <= 10) return { name: "Minor Rainy Season", type: "rainy" };
  return { name: "Dry Season (Harmattan)", type: "dry" };
}

export function getSeasonalRecommendations(month: number): string[] {
  const season = getCurrentSeason(month);
  if (season.type === "rainy") {
    return [
      "Plant maize, rice, and yam now for the rainy season",
      "Prepare cassava cuttings for planting",
      "Stock fish ponds while water levels rise",
      "Breed goats/sheep — kids/lambs will have good pasture",
      "Watch for increased pest and disease pressure",
      "Weed regularly — weeds grow fast in the rains",
    ];
  }
  return [
    "Focus on irrigated vegetable production (tomato, onion, cabbage)",
    "Harvest and store grains properly to avoid aflatoxin",
    "Prepare land for the coming rainy season",
    "Sell fattened livestock at premium festival prices",
    "Maintain fire belts around cashew and mango plantations",
    "Process harvested crops (shea butter, cassava into gari)",
  ];
}
