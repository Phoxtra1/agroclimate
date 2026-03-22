// Copy this file to: src/data/agro-data.ts in your other project

export interface Crop {
  name: string;
  icon: string;
  plantingSeason: string;
  harvestSeason: string;
  rainfall: string;
  irrigationNeeded: boolean;
  regions: string[];
  tips: string;
  yieldPerHectare: string;
  soilType: string;
  temperatureRange: string;
}

export interface CropCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  crops: Crop[];
}

export interface Season {
  name: string;
  type: "rainy" | "dry" | "harmattan";
  months: number[];
}

const seasons: Season[] = [
  { name: "Early Rainy Season", type: "rainy", months: [3, 4, 5] },
  { name: "Peak Rainy Season", type: "rainy", months: [6, 7, 8] },
  { name: "Late Rainy Season", type: "rainy", months: [9, 10] },
  { name: "Dry / Harmattan Season", type: "harmattan", months: [11, 12, 1, 2] },
];

export function getCurrentSeason(month: number): Season {
  return seasons.find((s) => s.months.includes(month)) ?? seasons[0];
}

export const cropCategories: CropCategory[] = [
  {
    id: "cash",
    name: "Cash Crops",
    icon: "💰",
    description: "High-value crops grown primarily for sale and export revenue.",
    crops: [
      {
        name: "Cocoa",
        icon: "🍫",
        plantingSeason: "March – June",
        harvestSeason: "September – January",
        rainfall: "1,500 – 2,000 mm/year",
        irrigationNeeded: false,
        regions: ["South-West", "South-South", "South-East"],
        tips: "Shade management with plantain or banana intercropping boosts early-year yield by up to 20%.",
        yieldPerHectare: "300 – 600 kg dried beans",
        soilType: "Deep, well-drained loamy soil",
        temperatureRange: "21 – 32 °C",
      },
      {
        name: "Oil Palm",
        icon: "🌴",
        plantingSeason: "May – August",
        harvestSeason: "Year-round (peak Jan – Apr)",
        rainfall: "1,800 – 2,500 mm/year",
        irrigationNeeded: false,
        regions: ["South-South", "South-East", "South-West"],
        tips: "Maintain 8–9 m spacing for optimal sunlight. Harvest bunches when 5+ loose fruits detach naturally.",
        yieldPerHectare: "15 – 25 tonnes fresh fruit bunches",
        soilType: "Deep laterite or alluvial soil",
        temperatureRange: "24 – 33 °C",
      },
      {
        name: "Rubber",
        icon: "🌳",
        plantingSeason: "April – July",
        harvestSeason: "Year-round after 6 years",
        rainfall: "1,800 – 2,500 mm/year",
        irrigationNeeded: false,
        regions: ["South-South", "South-West"],
        tips: "Begin tapping at 45 cm girth. Use downward half-spiral tapping for maximum latex flow.",
        yieldPerHectare: "1,200 – 1,800 kg dry rubber",
        soilType: "Deep, well-drained acidic soil",
        temperatureRange: "25 – 34 °C",
      },
      {
        name: "Cotton",
        icon: "🏵️",
        plantingSeason: "June – July",
        harvestSeason: "November – December",
        rainfall: "700 – 1,200 mm/year",
        irrigationNeeded: true,
        regions: ["North-West", "North-East", "North-Central"],
        tips: "Apply NPK fertilizer at 4 weeks. Scout for bollworm weekly from flowering stage.",
        yieldPerHectare: "1,000 – 2,500 kg seed cotton",
        soilType: "Sandy loam to clay loam",
        temperatureRange: "25 – 35 °C",
      },
    ],
  },
  {
    id: "cereal",
    name: "Cereals & Grains",
    icon: "🌾",
    description: "Staple food crops forming the backbone of nutrition and food security.",
    crops: [
      {
        name: "Maize (Corn)",
        icon: "🌽",
        plantingSeason: "March – May / August – September",
        harvestSeason: "July – August / November – December",
        rainfall: "600 – 1,200 mm/year",
        irrigationNeeded: true,
        regions: ["North-Central", "South-West", "North-West", "South-East"],
        tips: "Use early-maturing varieties (90 days) for double cropping. Apply urea at knee-height stage.",
        yieldPerHectare: "2,000 – 5,000 kg",
        soilType: "Well-drained loamy soil",
        temperatureRange: "20 – 30 °C",
      },
      {
        name: "Rice",
        icon: "🍚",
        plantingSeason: "May – July (rainfed) / Year-round (irrigated)",
        harvestSeason: "October – December",
        rainfall: "1,000 – 2,000 mm/year",
        irrigationNeeded: true,
        regions: ["North-Central", "South-South", "North-West", "South-West"],
        tips: "Maintain 5 cm water depth during tillering. FARO 44 and NERICA varieties perform well across zones.",
        yieldPerHectare: "3,000 – 6,000 kg paddy",
        soilType: "Clay or clay-loam (waterlogged)",
        temperatureRange: "22 – 32 °C",
      },
      {
        name: "Sorghum",
        icon: "🌿",
        plantingSeason: "June – July",
        harvestSeason: "October – November",
        rainfall: "400 – 800 mm/year",
        irrigationNeeded: false,
        regions: ["North-East", "North-West", "North-Central"],
        tips: "Drought-tolerant — ideal for savanna zones. Bird scaring is critical from grain filling to harvest.",
        yieldPerHectare: "1,000 – 3,000 kg",
        soilType: "Sandy loam to clay",
        temperatureRange: "25 – 38 °C",
      },
      {
        name: "Millet",
        icon: "🫘",
        plantingSeason: "June – July",
        harvestSeason: "September – October",
        rainfall: "300 – 600 mm/year",
        irrigationNeeded: false,
        regions: ["North-East", "North-West"],
        tips: "Most drought-resistant cereal. Intercrop with cowpea for nitrogen fixation and extra income.",
        yieldPerHectare: "800 – 2,000 kg",
        soilType: "Sandy, well-drained soil",
        temperatureRange: "27 – 40 °C",
      },
    ],
  },
  {
    id: "tuber",
    name: "Tubers & Roots",
    icon: "🥔",
    description: "Root and tuber crops — major carbohydrate sources and processing staples.",
    crops: [
      {
        name: "Cassava",
        icon: "🫛",
        plantingSeason: "April – June / September – October",
        harvestSeason: "9 – 18 months after planting",
        rainfall: "800 – 1,500 mm/year",
        irrigationNeeded: false,
        regions: ["South-West", "South-South", "South-East", "North-Central"],
        tips: "Use TME 419 or IITA improved varieties. Plant stem cuttings at 45° angle, 25 cm deep.",
        yieldPerHectare: "15,000 – 30,000 kg fresh tubers",
        soilType: "Sandy loam (well-drained)",
        temperatureRange: "25 – 35 °C",
      },
      {
        name: "Yam",
        icon: "🍠",
        plantingSeason: "February – April",
        harvestSeason: "August – December",
        rainfall: "1,000 – 1,500 mm/year",
        irrigationNeeded: false,
        regions: ["North-Central", "South-West", "South-East"],
        tips: "Stake plants for maximum tuber development. Mulch heavily after planting to conserve moisture.",
        yieldPerHectare: "10,000 – 25,000 kg",
        soilType: "Deep, friable loamy soil",
        temperatureRange: "25 – 30 °C",
      },
      {
        name: "Sweet Potato",
        icon: "🍠",
        plantingSeason: "April – June / August – September",
        harvestSeason: "3 – 5 months after planting",
        rainfall: "500 – 1,300 mm/year",
        irrigationNeeded: true,
        regions: ["North-Central", "South-West", "North-East"],
        tips: "Orange-fleshed varieties (OFSP) are rich in Vitamin A. Ridge planting improves tuber shape.",
        yieldPerHectare: "8,000 – 20,000 kg",
        soilType: "Sandy loam",
        temperatureRange: "20 – 30 °C",
      },
    ],
  },
  {
    id: "vegetable",
    name: "Vegetables",
    icon: "🥬",
    description: "High-demand vegetable crops for local markets and nutrition.",
    crops: [
      {
        name: "Tomato",
        icon: "🍅",
        plantingSeason: "October – January (dry season) / March – May",
        harvestSeason: "60 – 90 days after transplant",
        rainfall: "400 – 600 mm during growth",
        irrigationNeeded: true,
        regions: ["North-Central", "North-West", "South-West"],
        tips: "Stake and prune to 2 main stems. Drip irrigation reduces blight. Harvest at breaker stage for transport.",
        yieldPerHectare: "20,000 – 40,000 kg",
        soilType: "Rich loamy soil with compost",
        temperatureRange: "18 – 29 °C",
      },
      {
        name: "Pepper (Capsicum)",
        icon: "🌶️",
        plantingSeason: "March – May / September – October",
        harvestSeason: "70 – 90 days after transplant",
        rainfall: "500 – 800 mm during growth",
        irrigationNeeded: true,
        regions: ["North-Central", "South-West", "North-West"],
        tips: "Tatase and Rodo varieties dominate markets. Mulch to reduce soil splash and fungal disease.",
        yieldPerHectare: "8,000 – 15,000 kg",
        soilType: "Well-drained sandy loam",
        temperatureRange: "20 – 30 °C",
      },
      {
        name: "Okra",
        icon: "🥒",
        plantingSeason: "March – April / August – September",
        harvestSeason: "50 – 65 days after sowing",
        rainfall: "400 – 800 mm",
        irrigationNeeded: false,
        regions: ["North-Central", "South-West", "North-East", "South-East"],
        tips: "Harvest every 2–3 days when pods are 7–10 cm for tenderness. Very heat-tolerant crop.",
        yieldPerHectare: "4,000 – 8,000 kg",
        soilType: "Loamy to sandy loam",
        temperatureRange: "25 – 35 °C",
      },
      {
        name: "Leafy Greens (Ugwu / Spinach)",
        icon: "🥬",
        plantingSeason: "Year-round with irrigation",
        harvestSeason: "4 – 8 weeks after sowing",
        rainfall: "300 – 600 mm",
        irrigationNeeded: true,
        regions: ["South-East", "South-West", "South-South", "North-Central"],
        tips: "Ugwu (fluted pumpkin) leaves fetch premium prices. Train on trellises for clean, high-yield leaves.",
        yieldPerHectare: "5,000 – 12,000 kg leaves",
        soilType: "Rich, moist organic soil",
        temperatureRange: "20 – 30 °C",
      },
    ],
  },
  {
    id: "legume",
    name: "Legumes & Pulses",
    icon: "🫘",
    description: "Protein-rich crops that fix nitrogen and improve soil health.",
    crops: [
      {
        name: "Cowpea (Beans)",
        icon: "🫘",
        plantingSeason: "June – July / September",
        harvestSeason: "60 – 90 days after sowing",
        rainfall: "400 – 700 mm",
        irrigationNeeded: false,
        regions: ["North-East", "North-West", "North-Central"],
        tips: "IT97K-499-35 variety is pest-resistant. Spray against Maruca pod borer at flowering.",
        yieldPerHectare: "1,000 – 2,500 kg",
        soilType: "Sandy loam",
        temperatureRange: "25 – 35 °C",
      },
      {
        name: "Groundnut (Peanut)",
        icon: "🥜",
        plantingSeason: "May – June",
        harvestSeason: "September – October",
        rainfall: "500 – 1,000 mm",
        irrigationNeeded: false,
        regions: ["North-Central", "North-West", "North-East"],
        tips: "Inoculate seeds with Rhizobium for better nodulation. Dry pods to 8% moisture before storage.",
        yieldPerHectare: "1,500 – 3,000 kg unshelled",
        soilType: "Light sandy loam",
        temperatureRange: "25 – 35 °C",
      },
      {
        name: "Soybean",
        icon: "🌱",
        plantingSeason: "June – July",
        harvestSeason: "October – November",
        rainfall: "600 – 1,000 mm",
        irrigationNeeded: false,
        regions: ["North-Central", "South-West"],
        tips: "TGx varieties adapted to tropical conditions. Excellent rotation crop before maize.",
        yieldPerHectare: "1,500 – 3,000 kg",
        soilType: "Well-drained loamy soil",
        temperatureRange: "20 – 30 °C",
      },
    ],
  },
];
