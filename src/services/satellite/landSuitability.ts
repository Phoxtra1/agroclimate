import type { GeoPoint } from "@/services/satellite/navigation";

export type ClimateFit = "within_reference_envelope" | "outside_reference_envelope" | "unknown";

export interface CropClimateReference {
  crop: string;
  temperatureC: [number, number];
  annualRainfallMm: [number, number];
  notes: string;
}

export interface LandClimateAssessment {
  coordinates: GeoPoint;
  elevationM: number | null;
  annualMeanTemperatureC: number | null;
  meanMonthlyTemperatureC: Record<string, number | null>;
  estimatedAnnualRainfallMm: number | null;
  meanMonthlyRainfallMm: Record<string, number | null>;
  cropScreens: Array<{
    crop: string;
    temperatureFit: ClimateFit;
    rainfallFit: ClimateFit;
    climateScreen: ClimateFit;
    reference: CropClimateReference;
    explanation: string;
  }>;
  assessmentType: "preliminary_climate_screen_only";
  sources: Array<{
    name: string;
    url: string;
    observationPeriod: string;
    spatialResolution: string;
    limitations: string;
  }>;
  unavailableEvidence: string[];
  confidence: "low" | "moderate";
  assessedAt: string;
}

export const CROP_CLIMATE_REFERENCES: CropClimateReference[] = [
  { crop: "Maize", temperatureC: [18, 30], annualRainfallMm: [500, 1200], notes: "Broad crop-level climatic guide; cultivar, planting date and water management materially change requirements." },
  { crop: "Rice", temperatureC: [20, 35], annualRainfallMm: [1000, 2000], notes: "Irrigated and rain-fed rice have very different water requirements; annual rainfall alone is not an irrigation assessment." },
  { crop: "Cassava", temperatureC: [20, 30], annualRainfallMm: [500, 1500], notes: "Tolerates seasonal dry periods after establishment; prolonged drought and poor drainage remain important." },
  { crop: "Yam", temperatureC: [20, 30], annualRainfallMm: [1000, 1500], notes: "Planting material, soil depth, drainage and local species/cultivar are important." },
  { crop: "Cocoa", temperatureC: [21, 32], annualRainfallMm: [1500, 2500], notes: "Requires humid conditions, suitable shade and deep, well-drained soils; rainfall totals do not establish suitability." },
  { crop: "Oil Palm", temperatureC: [24, 32], annualRainfallMm: [1800, 2500], notes: "Commercial suitability also depends on dry-season length, soils, water, slope and environmental safeguards." },
  { crop: "Soybean", temperatureC: [20, 30], annualRainfallMm: [450, 900], notes: "Photoperiod, inoculation, variety and rainfall timing affect yields." },
  { crop: "Sorghum", temperatureC: [22, 32], annualRainfallMm: [400, 1000], notes: "Drought tolerance varies strongly by variety and establishment conditions." },
  { crop: "Millet", temperatureC: [25, 35], annualRainfallMm: [300, 800], notes: "Pearl, finger and other millets differ; rainfall distribution and soil constraints matter." },
  { crop: "Groundnut", temperatureC: [22, 30], annualRainfallMm: [500, 1000], notes: "Requires suitable soil structure and drainage; crop disease and harvest weather are important." },
  { crop: "Tomato", temperatureC: [18, 27], annualRainfallMm: [400, 800], notes: "Irrigation and protected cultivation can change the climate envelope; heat during flowering can reduce fruit set." },
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function finiteOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > -900 ? number : null;
}

function extractMonthly(payload: any, parameter: string): Record<string, number | null> {
  const source = payload?.properties?.parameter?.[parameter];
  return Object.fromEntries(MONTHS.map((month) => [month, finiteOrNull(source?.[month])]));
}

function evaluateFit(value: number | null, range: [number, number]): ClimateFit {
  if (value === null) return "unknown";
  return value >= range[0] && value <= range[1] ? "within_reference_envelope" : "outside_reference_envelope";
}

export async function assessLandClimate(point: GeoPoint, signal?: AbortSignal): Promise<LandClimateAssessment> {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90
    || !Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) {
    throw new Error("Valid WGS84 latitude and longitude are required.");
  }

  const climateUrl = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  climateUrl.searchParams.set("parameters", "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR");
  climateUrl.searchParams.set("community", "AG");
  climateUrl.searchParams.set("longitude", String(point.lon));
  climateUrl.searchParams.set("latitude", String(point.lat));
  climateUrl.searchParams.set("format", "JSON");

  const elevationUrl = new URL("https://api.open-meteo.com/v1/elevation");
  elevationUrl.searchParams.set("latitude", String(point.lat));
  elevationUrl.searchParams.set("longitude", String(point.lon));

  const [climateResponse, elevationResponse] = await Promise.all([
    fetch(climateUrl, { signal }),
    fetch(elevationUrl, { signal }),
  ]);

  if (!climateResponse.ok) {
    throw new Error(`NASA POWER climatology is unavailable (HTTP ${climateResponse.status}). No substitute climate values were generated.`);
  }
  const climatePayload = await climateResponse.json();
  if (climatePayload?.messages?.error?.length) {
    throw new Error(String(climatePayload.messages.error.join("; ")));
  }

  const meanTemps = extractMonthly(climatePayload, "T2M");
  const dailyRain = extractMonthly(climatePayload, "PRECTOTCORR");
  const tempValues = Object.values(meanTemps).filter((v): v is number => v !== null);
  const rainValues = Object.values(dailyRain);
  const annualMeanTemperatureC = tempValues.length
    ? tempValues.reduce((sum, value) => sum + value, 0) / tempValues.length
    : null;

  // NASA POWER PRECTOTCORR is a mean daily precipitation rate (mm/day) in the
  // climatology product. Multiply each monthly daily mean by month length.
  const rainMonths = MONTHS.map((month, index) => {
    const value = dailyRain[month];
    return value === null ? null : value * DAYS_IN_MONTH[index];
  });
  const estimatedAnnualRainfallMm = rainMonths.every((v) => v !== null)
    ? rainMonths.reduce((sum, v) => sum + (v ?? 0), 0)
    : null;

  let elevationM: number | null = null;
  if (elevationResponse.ok) {
    const elevationPayload = await elevationResponse.json();
    elevationM = finiteOrNull(elevationPayload?.elevation?.[0]);
  }

  const cropScreens = CROP_CLIMATE_REFERENCES.map((reference) => {
    const temperatureFit = evaluateFit(annualMeanTemperatureC, reference.temperatureC);
    const rainfallFit = evaluateFit(estimatedAnnualRainfallMm, reference.annualRainfallMm);
    const climateScreen: ClimateFit = temperatureFit === "unknown" || rainfallFit === "unknown"
      ? "unknown"
      : temperatureFit === "within_reference_envelope" && rainfallFit === "within_reference_envelope"
        ? "within_reference_envelope"
        : "outside_reference_envelope";
    return {
      crop: reference.crop,
      temperatureFit,
      rainfallFit,
      climateScreen,
      reference,
      explanation: climateScreen === "within_reference_envelope"
        ? "The available long-term temperature and annual-rainfall indicators fall within this broad reference envelope. This is not proof of land or crop suitability."
        : climateScreen === "outside_reference_envelope"
          ? "At least one available long-term climate indicator is outside this broad reference envelope. Local varieties, irrigation and management may change the assessment."
          : "One or more climate indicators are unavailable, so this crop cannot be screened reliably.",
    };
  });

  const unavailableEvidence = [
    "Soil pH, texture, organic carbon, nutrient status and rooting depth: no current point-level soil result was available.",
    "SoilGrids REST service is temporarily paused; this assessment does not substitute synthetic soil values.",
    "FAO GAEZ crop-suitability rasters have not yet been ingested into AgroClimate.",
    "Parcel slope, aspect, field-scale drainage, protected-area status, water rights, land tenure and road access were not assessed.",
    "Crop cultivar, planting date, pest pressure, irrigation availability and local agronomic extension advice were not supplied.",
  ];
  if (elevationM === null) unavailableEvidence.push("Copernicus GLO-90 elevation query was unavailable for this point.");

  const units = climatePayload?.parameters || climatePayload?.properties?.parameter?.units || {};
  return {
    coordinates: point,
    elevationM,
    annualMeanTemperatureC: annualMeanTemperatureC === null ? null : Number(annualMeanTemperatureC.toFixed(1)),
    meanMonthlyTemperatureC: meanTemps,
    estimatedAnnualRainfallMm: estimatedAnnualRainfallMm === null ? null : Number(estimatedAnnualRainfallMm.toFixed(0)),
    meanMonthlyRainfallMm: Object.fromEntries(MONTHS.map((month, index) => [
      month,
      rainMonths[index] === null ? null : Number((rainMonths[index] as number).toFixed(1)),
    ])),
    cropScreens,
    assessmentType: "preliminary_climate_screen_only",
    sources: [
      {
        name: "NASA POWER Climatology API",
        url: climateUrl.toString(),
        observationPeriod: "Climatology product period; see source metadata",
        spatialResolution: "Gridded climate data; not field-scale soil or weather measurements",
        limitations: "Long-term climate normals, not current observations, seasonal forecast or microclimate conditions. Units and metadata are retained with the response.",
      },
      {
        name: "Copernicus DEM GLO-90 via Open-Meteo Elevation API",
        url: elevationUrl.toString(),
        observationPeriod: "Copernicus DEM 2021 release",
        spatialResolution: "90 m",
        limitations: "Point elevation only; does not calculate parcel slope, drainage or flood depth.",
      },
    ],
    unavailableEvidence,
    confidence: elevationM !== null && tempValues.length >= 10 && rainValues.filter((v) => v !== null).length >= 10 ? "moderate" : "low",
    assessedAt: new Date().toISOString(),
  };
}
