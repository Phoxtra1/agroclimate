export type TelemetryPoint = {
  date: string;
  observed: number;
  average7d: number;
  upperBand: number;
  lowerBand: number;
};

export type StationNode = {
  id: string;
  name: string;
  subLabel: string;
  metricLabel: string;
  metricValue: string;
  delta: string;
  deltaType: "up" | "down" | "neutral";
  sensor: "AIS" | "SAR" | "MSI" | "MODIS" | "COM";
  sensorDate: string;
  status: "active" | "fanning" | "falling" | "rising" | "awaiting" | "stale";
  statusText?: string;
  lat: number;
  lon: number;
  sparkline?: number[];
};

export type StrategicBoard = {
  id: string;
  title: string;
  beta?: boolean;
  category: "maritime" | "commodity" | "energy" | "battery" | "agriculture" | "climate";
  summary: string;
  regionalRead: string;
  statusBadges: string[];
  staleDays?: number;
  center: [number, number]; // [lat, lon]
  zoom: number;
  primaryStationId: string;
  stations: StationNode[];
  corridorLine: [number, number][]; // [[lat, lon], ...]
  corridorLabel?: string;
  history30d: TelemetryPoint[];
  history90d: TelemetryPoint[];
  history1y: TelemetryPoint[];
  timeframeUnit: string;
  currentStatMetric: string;
  currentStatValue: string;
  currentStatSub: string;
};

// Generate realistic daily time series matching the screenshot's trend curves
function generateTimeSeries(
  days: number,
  baseMean: number,
  variance: number,
  trendSlope: number
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const now = new Date("2026-07-31T00:00:00Z");

  const dailyValues: number[] = [];

  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // pseudo-deterministic sine + noise
    const dayProgress = (days - i) / days;
    const wave = Math.sin(i * 0.45) * variance;
    const trend = (dayProgress - 0.5) * trendSlope * 10;
    const obs = Math.max(1, Math.round((baseMean + wave + trend + ((i * 13) % 7) - 3) * 10) / 10);
    dailyValues.push(obs);

    // 7d rolling average
    const slice = dailyValues.slice(Math.max(0, dailyValues.length - 7));
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    points.push({
      date: dateStr,
      observed: obs,
      average7d: roundedAvg,
      upperBand: Math.round((roundedAvg + variance * 0.9) * 10) / 10,
      lowerBand: Math.max(0, Math.round((roundedAvg - variance * 0.9) * 10) / 10),
    });
  }

  return points;
}

export const STRATEGIC_BOARDS: StrategicBoard[] = [
  {
    id: "bab-el-mandeb",
    title: "Bab el-Mandeb — gate transits (settled AIS, typed)",
    beta: true,
    category: "maritime",
    summary:
      "The live state of shipping from the Gulf of Aden, through the Bab el-Mandeb strait, up past Hodeidah to Yanbu. Ship movements come from ship transponders (AIS); counts at anchorages come from radar satellite (SAR).",
    regionalRead:
      "Regional read — what the stations say together (descriptive, not a forecast). Each station is an independent measurement: confirmed daily gate crossings from ship transponders (AIS); the middle-half spread band per corridor station; distinct ships per week off Yanbu.",
    statusBadges: ["FANNED OUT", "ABOVE USUAL", "STALE 11d"],
    staleDays: 11,
    center: [13.25, 43.15],
    zoom: 7,
    primaryStationId: "gate",
    timeframeUnit: "transits/day",
    currentStatMetric: "14",
    currentStatValue: "transits/day",
    currentStatSub: "TRANSIT COUNT · DAILY",
    stations: [
      {
        id: "yanbu",
        name: "Yanbu approaches",
        subLabel: "Red Sea northern transit",
        metricLabel: "209 vessels/week",
        metricValue: "209",
        delta: "▼ -24 · 7d",
        deltaType: "down",
        sensor: "AIS",
        sensorDate: "07-28",
        status: "falling",
        lat: 23.95,
        lon: 38.05,
        sparkline: [240, 235, 228, 220, 215, 209],
      },
      {
        id: "ras-isa",
        name: "Ras Isa / Kamaran",
        subLabel: "Yemen Anchorage SAR count",
        metricLabel: "30 count",
        metricValue: "30",
        delta: "▲ +1 · prev",
        deltaType: "up",
        sensor: "SAR",
        sensorDate: "07-19",
        status: "stale",
        statusText: "STALE 12d",
        lat: 15.18,
        lon: 42.6,
        sparkline: [27, 28, 29, 29, 30],
      },
      {
        id: "hodeidah-east",
        name: "Hodeidah - east",
        subLabel: "Inner channel corridor",
        metricLabel: "88.5 km",
        metricValue: "88.5",
        delta: "▲ +2.2 · 7d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-28",
        status: "active",
        lat: 14.8,
        lon: 42.95,
        sparkline: [82, 84, 85, 87, 88.5],
      },
      {
        id: "hodeidah-west",
        name: "Hodeidah - west",
        subLabel: "Outer deep-draft channel",
        metricLabel: "14.9 km",
        metricValue: "14.9",
        delta: "▼ -67.9 · 7d",
        deltaType: "down",
        sensor: "AIS",
        sensorDate: "07-28",
        status: "falling",
        lat: 14.7,
        lon: 42.3,
        sparkline: [85, 60, 42, 28, 14.9],
      },
      {
        id: "gate",
        name: "Bab el-Mandeb gate",
        subLabel: "Main choke point transit",
        metricLabel: "14 transits/day",
        metricValue: "14",
        delta: "▼ -11 · 1d",
        deltaType: "down",
        sensor: "AIS",
        sensorDate: "07-30",
        status: "falling",
        lat: 12.58,
        lon: 43.33,
        sparkline: [32, 28, 26, 21, 18, 14],
      },
      {
        id: "hanish",
        name: "Hanish Islands",
        subLabel: "Southern archipelago pass",
        metricLabel: "— AWAITING DATA",
        metricValue: "Awaiting",
        delta: "—",
        deltaType: "neutral",
        sensor: "AIS",
        sensorDate: "07-31",
        status: "awaiting",
        lat: 13.72,
        lon: 42.75,
        sparkline: [0, 0, 0],
      },
      {
        id: "gulf-aden",
        name: "Gulf of Aden",
        subLabel: "Eastern convoy staging",
        metricLabel: "13.5 km",
        metricValue: "13.5",
        delta: "▲ +1 · 7d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-30",
        status: "rising",
        lat: 11.9,
        lon: 44.8,
        sparkline: [11, 11.5, 12, 13, 13.5],
      },
    ],
    corridorLine: [
      [23.95, 38.05],
      [21.5, 39.1],
      [18.8, 40.5],
      [16.5, 41.6],
      [15.18, 42.6],
      [14.75, 42.62],
      [13.72, 42.75],
      [12.58, 43.33],
      [11.9, 44.8],
    ],
    corridorLabel: "Red Sea ↔ Gulf of Aden lane",
    history30d: generateTimeSeries(30, 22, 5.5, -0.2),
    history90d: generateTimeSeries(90, 28, 7, -0.15),
    history1y: generateTimeSeries(365, 45, 12, -0.4),
  },

  {
    id: "west-africa-agri-corridor",
    title: "West Africa — Tema Port & Volta Agricultural Belt",
    category: "agriculture",
    summary:
      "Live observation of crop health, grain silos, fertilizer imports, and agricultural transit flows from Tema Deepwater Port through Kumasi to the Northern Savanna grain basket. Corroborates Sentinel-2 NDVI with port customs cargo manifests.",
    regionalRead:
      "Vegetation vigor across the middle belt remains robust (mean NDVI 0.68) with timely rainfall. Tema port grain bulk discharge is steady with 18.2k MT processed in the last 24h.",
    statusBadges: ["VIGOROUS", "SEASONAL ON TRACK", "LIVE AIS"],
    center: [6.8, -0.5],
    zoom: 7,
    primaryStationId: "tema-grain",
    timeframeUnit: "k MT/day",
    currentStatMetric: "18.2k",
    currentStatValue: "MT processed/day",
    currentStatSub: "GRAIN & FEED FLOW",
    stations: [
      {
        id: "tema-grain",
        name: "Tema Port Agri-Terminal",
        subLabel: "Bulk grain and fertilizer discharge",
        metricLabel: "18.2k MT/day",
        metricValue: "18.2k",
        delta: "▲ +3.4k · 7d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-31",
        status: "rising",
        lat: 5.62,
        lon: -0.01,
        sparkline: [14.2, 15.0, 16.5, 17.8, 18.2],
      },
      {
        id: "kumasi-hub",
        name: "Kumasi Logistics Central",
        subLabel: "Intermodal distribution & transit",
        metricLabel: "420 trucks/day",
        metricValue: "420",
        delta: "▲ +18 · 7d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-30",
        status: "active",
        lat: 6.69,
        lon: -1.62,
        sparkline: [390, 402, 410, 415, 420],
      },
      {
        id: "afram-plains",
        name: "Afram Plains Maize Hub",
        subLabel: "Sentinel-2 Sentinel NDVI index",
        metricLabel: "0.72 NDVI",
        metricValue: "0.72",
        delta: "▲ +0.08 · 10d",
        deltaType: "up",
        sensor: "MSI",
        sensorDate: "07-29",
        status: "rising",
        lat: 7.02,
        lon: -0.22,
        sparkline: [0.61, 0.64, 0.68, 0.7, 0.72],
      },
      {
        id: "tamale-silo",
        name: "Tamale Strategic Grain Reserve",
        subLabel: "Cereal inventory level (SAR & telemetry)",
        metricLabel: "84.5k MT",
        metricValue: "84.5k",
        delta: "▼ -2.1k · 7d",
        deltaType: "down",
        sensor: "SAR",
        sensorDate: "07-28",
        status: "active",
        lat: 9.4,
        lon: -0.84,
        sparkline: [88.2, 87.0, 86.1, 85.2, 84.5],
      },
    ],
    corridorLine: [
      [5.62, -0.01],
      [5.85, -0.25],
      [6.3, -0.9],
      [6.69, -1.62],
      [7.5, -1.75],
      [8.5, -1.4],
      [9.4, -0.84],
    ],
    corridorLabel: "Tema ↔ Tamale Central Agro-Freight Lane",
    history30d: generateTimeSeries(30, 16.5, 3.2, 0.1),
    history90d: generateTimeSeries(90, 15.0, 4.0, 0.15),
    history1y: generateTimeSeries(365, 14.0, 6.0, 0.2),
  },

  {
    id: "guinea-china-bauxite",
    title: "China bauxite port stocks — Guinea supply flow",
    category: "commodity",
    summary:
      "Bulk ore carriers crossing the Atlantic & Indian Oceans from Kamsar, Guinea to Shandong & Caofeidian ports. Inventory estimation derived from optical satellite pile profiling and SAR vessel drafts.",
    regionalRead:
      "Port stockpiles across northern Chinese discharge hubs are hovering at 34.1 Mt, up 2.4 Mt on the month due to continuous Capesize transits arriving via the Cape of Good Hope.",
    statusBadges: ["STOCKPILES HIGH", "VESSELS QUEUED", "LIVE RADAR"],
    center: [10.65, -14.6],
    zoom: 6,
    primaryStationId: "kamsar",
    timeframeUnit: "Million Tonnes",
    currentStatMetric: "34.1",
    currentStatValue: "Mt in stock",
    currentStatSub: "BODILY INVENTORY · 30 PORTS",
    stations: [
      {
        id: "kamsar",
        name: "Port Kamsar Loading Berth",
        subLabel: "Capesize vessel loader stream",
        metricLabel: "12 vessels/mo",
        metricValue: "12",
        delta: "▲ +2 · prev",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-29",
        status: "rising",
        lat: 10.66,
        lon: -14.61,
        sparkline: [8, 9, 10, 11, 12],
      },
      {
        id: "shandong-stock",
        name: "Shandong Ports Bauxite Depots",
        subLabel: "Yantai & Rizhao stockpiles",
        metricLabel: "34.1 Mt",
        metricValue: "34.1",
        delta: "▲ +0.6 Mt · 7d",
        deltaType: "up",
        sensor: "SAR",
        sensorDate: "07-27",
        status: "rising",
        lat: 37.54,
        lon: 121.39,
        sparkline: [31.5, 32.2, 33.0, 33.6, 34.1],
      },
    ],
    corridorLine: [
      [10.66, -14.61],
      [5.0, -18.0],
      [-15.0, -2.0],
      [-34.5, 18.5],
      [-35.0, 25.0],
      [-10.0, 75.0],
      [5.0, 95.0],
      [15.0, 115.0],
      [37.54, 121.39],
    ],
    corridorLabel: "Guinea ↔ China Cape-Route Super-Corridor",
    history30d: generateTimeSeries(30, 32.5, 2.0, 0.08),
    history90d: generateTimeSeries(90, 30.0, 3.5, 0.12),
    history1y: generateTimeSeries(365, 26.0, 5.0, 0.25),
  },

  {
    id: "strait-of-hormuz",
    title: "Strait of Hormuz — Crude & LNG Outflow Gate",
    category: "energy",
    summary:
      "Tracking settled VLCC crude tankers, LNG carriers, and bunkering operations navigating the narrow transit separation scheme between Oman and Iran using dual AIS and Sentinel-1 SAR.",
    regionalRead:
      "Export flow rate remains resilient at 24.8 million barrels/day with orderly traffic through both inbound and outbound traffic lanes.",
    statusBadges: ["NOMINAL FLOW", "NO LANE BLOCKAGES", "HIGH RADAR CLARITY"],
    center: [26.56, 56.25],
    zoom: 8,
    primaryStationId: "hormuz-gate",
    timeframeUnit: "Mb/d",
    currentStatMetric: "24.8",
    currentStatValue: "Mb/day export",
    currentStatSub: "CRUDE & CONDENSATE FLOW",
    stations: [
      {
        id: "hormuz-gate",
        name: "Hormuz Strait TSS Gate",
        subLabel: "Outbound lane daily passage",
        metricLabel: "24.8 Mb/d",
        metricValue: "24.8",
        delta: "▲ +0.9 · 7d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-30",
        status: "active",
        lat: 26.56,
        lon: 56.45,
        sparkline: [23.1, 23.9, 24.2, 24.5, 24.8],
      },
      {
        id: "fujairah-anchorage",
        name: "Fujairah Offshore Anchorage",
        subLabel: "Bunkering and awaiting orders",
        metricLabel: "78 tankers",
        metricValue: "78",
        delta: "▼ -4 · 7d",
        deltaType: "down",
        sensor: "SAR",
        sensorDate: "07-28",
        status: "falling",
        lat: 25.18,
        lon: 56.42,
        sparkline: [86, 84, 82, 80, 78],
      },
    ],
    corridorLine: [
      [27.0, 51.5],
      [26.7, 53.0],
      [26.5, 55.0],
      [26.56, 56.45],
      [25.5, 57.2],
      [24.5, 58.5],
    ],
    corridorLabel: "Persian Gulf ↔ Arabian Sea TSS Lane",
    history30d: generateTimeSeries(30, 23.5, 1.8, 0.05),
    history90d: generateTimeSeries(90, 22.8, 2.5, 0.08),
    history1y: generateTimeSeries(365, 21.5, 4.0, 0.1),
  },

  {
    id: "panama-canal-grain",
    title: "Panama Canal — Grain & Agri-Logistics Transits",
    category: "agriculture",
    summary:
      "Tracking US Gulf soybean, maize, and Latin America grain bulkers queueing and crossing Miraflores, Pedro Miguel, and Gatun locks.",
    regionalRead:
      "Gatun lake water levels restored following seasonal rains; daily bookable transit slots now at 28 transits/day, eliminating long anchorage delays.",
    statusBadges: ["RESTORED DRAFT", "NORMAL DELAY <24H", "OPTICAL PASS"],
    center: [9.1, -79.7],
    zoom: 9,
    primaryStationId: "miraflores",
    timeframeUnit: "transits/day",
    currentStatMetric: "28",
    currentStatValue: "transits/day",
    currentStatSub: "NEOPANAMAX & PANAMAX TOTAL",
    stations: [
      {
        id: "miraflores",
        name: "Miraflores / Pacific Gate",
        subLabel: "Pacific outbound lock transit",
        metricLabel: "28 transits/day",
        metricValue: "28",
        delta: "▲ +4 · 30d",
        deltaType: "up",
        sensor: "AIS",
        sensorDate: "07-30",
        status: "rising",
        lat: 8.99,
        lon: -79.59,
        sparkline: [22, 24, 25, 27, 28],
      },
      {
        id: "gatun-anchorage",
        name: "Cristobal / Atlantic Anchorage",
        subLabel: "Vessels waiting for transit slots",
        metricLabel: "14 waiting",
        metricValue: "14",
        delta: "▼ -18 · 30d",
        deltaType: "down",
        sensor: "SAR",
        sensorDate: "07-29",
        status: "active",
        lat: 9.38,
        lon: -79.92,
        sparkline: [38, 30, 24, 18, 14],
      },
    ],
    corridorLine: [
      [9.38, -79.92],
      [9.28, -79.91],
      [9.15, -79.8],
      [9.05, -79.7],
      [8.99, -79.59],
      [8.9, -79.52],
    ],
    corridorLabel: "Atlantic ↔ Pacific Canal Channel",
    history30d: generateTimeSeries(30, 26, 3, 0.1),
    history90d: generateTimeSeries(90, 24, 4, 0.15),
    history1y: generateTimeSeries(365, 20, 6, 0.25),
  },

  {
    id: "lithium-triangle-battery",
    title: "Atacama & Puna Salt Flats — Lithium Brine Pools",
    category: "battery",
    summary:
      "Satellite surface reflectance, evaporation pan depth, and lithium brine processing output across Salar de Atacama and Salar del Hombre Muerto.",
    regionalRead:
      "Total active evaporation pan surface area expanded 4.2% YoY. Brine extraction rates monitored via high-resolution multispectral water indices (NDWI).",
    statusBadges: ["EXPANDING", "DRY SEASON OPTIMAL", "MSI HIGH-RES"],
    center: [-23.5, -68.3],
    zoom: 9,
    primaryStationId: "atacama-evap",
    timeframeUnit: "k MT LCE/mo",
    currentStatMetric: "21.4k",
    currentStatValue: "MT LCE equivalent",
    currentStatSub: "BRINE HARVEST ESTIMATE",
    stations: [
      {
        id: "atacama-evap",
        name: "Salar de Atacama Pan Cluster",
        subLabel: "Evaporation ponds active area",
        metricLabel: "21.4k MT LCE",
        metricValue: "21.4k",
        delta: "▲ +1.2k · 30d",
        deltaType: "up",
        sensor: "MSI",
        sensorDate: "07-28",
        status: "rising",
        lat: -23.55,
        lon: -68.25,
        sparkline: [18.2, 19.5, 20.1, 20.8, 21.4],
      },
    ],
    corridorLine: [
      [-23.3, -68.4],
      [-23.55, -68.25],
      [-23.8, -68.1],
    ],
    corridorLabel: "Atacama Brine Conveyance",
    history30d: generateTimeSeries(30, 20.5, 1.2, 0.05),
    history90d: generateTimeSeries(90, 19.8, 2.0, 0.08),
    history1y: generateTimeSeries(365, 17.5, 3.2, 0.15),
  },
];
