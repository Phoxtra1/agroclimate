import type { GeoPoint } from "@/services/satellite/navigation";

/**
 * FAO EcoCrop species-level climate reference record.
 * These values are ecological reference estimates, not cultivar-specific yield
 * thresholds or a legal/technical determination of land suitability.
 */
export type ClimateFit =
  | "within_optimal_range"
  | "within_absolute_range_only"
  | "outside_absolute_range"
  | "unknown";

export interface CropClimateReference {
  crop: string;
  scientificName: string;
  ecoCropId: number;
  optimalTemperatureC: [number, number];
  absoluteTemperatureC: [number, number];
  optimalAnnualRainfallMm: [number, number];
  absoluteAnnualRainfallMm: [number, number];
  soilDepth: string;
  soilTexture: string;
  soilFertility: string;
  soilPhOptimal: [number, number] | null;
  soilPhAbsolute: [number, number] | null;
  drainage: string;
  sourceUrl: string;
  notes: string;
}

export interface LandClimateAssessment {
  coordinates: GeoPoint;
  elevationM: number | null;
  annualMeanTemperatureC: number | null;
  meanMonthlyTemperatureC: Record<string, number | null>;
  estimatedAnnualRainfallMm: number | null;
  meanMonthlyRainfallMm: Record<string, number | null>;
  temperatureUnits: string;
  precipitationUnits: string;
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
  confidence: "low";
  assessedAt: string;
}

/**
 * Species records transcribed from the linked FAO EcoCrop data sheets.
 * Crop names without an ingested/checked data sheet are intentionally omitted
 * until a source record can be validated.
 */
export const CROP_CLIMATE_REFERENCES: CropClimateReference[] = [
  {
    crop: "Maize", scientificName: "Zea mays", ecoCropId: 2175,
    optimalTemperatureC: [18, 33], absoluteTemperatureC: [10, 47],
    optimalAnnualRainfallMm: [600, 1200], absoluteAnnualRainfallMm: [400, 1800],
    soilDepth: "Medium (50–150 cm) optimal; shallow (20–50 cm) absolute", soilTexture: "Not specified in this FAO sheet",
    soilFertility: "High optimal; low absolute",
    soilPhOptimal: [5, 7], soilPhAbsolute: [4.5, 8.5],
    drainage: "Field drainage must be checked",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2175",
    notes: "Species-level FAO EcoCrop reference. Cultivar, photoperiod, planting date, rainfall distribution and management change local performance.",
  },
  {
    crop: "Rice", scientificName: "Oryza sativa", ecoCropId: 1574,
    optimalTemperatureC: [20, 30], absoluteTemperatureC: [10, 36],
    optimalAnnualRainfallMm: [1500, 2000], absoluteAnnualRainfallMm: [1000, 4000],
    soilDepth: "Variable", soilTexture: "Broad range; production system specific",
    soilFertility: "Field soil result required",
    soilPhOptimal: [5.5, 7], soilPhAbsolute: [4.5, 9],
    drainage: "FAO sheet describes poor drainage / saturated conditions; irrigated and upland rice must be assessed separately",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1574",
    notes: "Annual rainfall is not an irrigation water budget. Rice production system, flood control, water quality and seasonal timing matter.",
  },
  {
    crop: "Cassava", scientificName: "Manihot esculenta", ecoCropId: 1420,
    optimalTemperatureC: [20, 29], absoluteTemperatureC: [10, 35],
    optimalAnnualRainfallMm: [1000, 1500], absoluteAnnualRainfallMm: [500, 5000],
    soilDepth: "Medium (50–150 cm)", soilTexture: "Optimal medium/light; absolute heavy/medium/light/organic",
    soilFertility: "Optimal moderate; absolute low",
    soilPhOptimal: [5.5, 8], soilPhAbsolute: [4, 9],
    drainage: "Well drained with dry spells; excessive drainage can be tolerated",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1420",
    notes: "The very broad absolute rainfall envelope must not be interpreted as expected yield. Cultivar, rooting depth and drainage matter.",
  },
  {
    crop: "White yam", scientificName: "Dioscorea rotundata", ecoCropId: 942,
    optimalTemperatureC: [25, 32], absoluteTemperatureC: [15, 38],
    optimalAnnualRainfallMm: [1000, 1500], absoluteAnnualRainfallMm: [800, 3000],
    soilDepth: "Deep (>150 cm) optimal; medium (50–150 cm) absolute", soilTexture: "Heavy optimal; heavy/medium absolute",
    soilFertility: "High optimal; moderate absolute",
    soilPhOptimal: [6.4, 6.7], soilPhAbsolute: [5.8, 8.5],
    drainage: "Well-drained field soil preferred; field verification needed",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=942",
    notes: "White yam / Guinea yam reference; do not generalise these species values to every yam species or local cultivar.",
  },
  {
    crop: "Cocoa", scientificName: "Theobroma cacao", ecoCropId: 2074,
    optimalTemperatureC: [21, 32], absoluteTemperatureC: [10, 38],
    optimalAnnualRainfallMm: [1200, 3000], absoluteAnnualRainfallMm: [900, 7600],
    soilDepth: "Deep (>150 cm) optimal; medium (50–150 cm) absolute",
    soilTexture: "Heavy/organic optimal; heavy/medium/light absolute",
    soilFertility: "Moderate optimal and absolute",
    soilPhOptimal: [5, 6.5], soilPhAbsolute: [4, 8],
    drainage: "Well drained with dry spells",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2074",
    notes: "Shade, humidity, wind exposure, disease pressure, landscape and soil depth are important and are not established by this climate screen.",
  },
  {
    crop: "Oil palm", scientificName: "Elaeis guineensis", ecoCropId: 972,
    optimalTemperatureC: [20, 35], absoluteTemperatureC: [12, 38],
    optimalAnnualRainfallMm: [1500, 3000], absoluteAnnualRainfallMm: [1000, 8000],
    soilDepth: "Deep (>150 cm) optimal; medium (50–150 cm) absolute",
    soilTexture: "Heavy/medium optimal; heavy/medium/light absolute",
    soilFertility: "High optimal; moderate absolute",
    soilPhOptimal: [4.5, 6], soilPhAbsolute: [3.2, 8],
    drainage: "Field drainage and seasonal water balance need verification",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=972",
    notes: "Commercial planning must also assess peat/wetlands, biodiversity, land-use legality, dry-season deficit and processing access.",
  },
  {
    crop: "Soybean", scientificName: "Glycine max", ecoCropId: 1150,
    optimalTemperatureC: [20, 33], absoluteTemperatureC: [10, 38],
    optimalAnnualRainfallMm: [600, 1500], absoluteAnnualRainfallMm: [450, 1800],
    soilDepth: "Medium (50–150 cm) optimal; shallow (20–50 cm) absolute",
    soilTexture: "Medium/organic optimal; heavy/medium/light absolute",
    soilFertility: "High optimal; low absolute",
    soilPhOptimal: [5.5, 6.5], soilPhAbsolute: [4.5, 8.4],
    drainage: "Optimal well-drained with dry spells; absolute range includes poor, well and excessive drainage",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1150",
    notes: "Photoperiod, inoculation, cultivar, phosphorus status and rainfall during flowering/pod fill matter.",
  },
  {
    crop: "Sorghum", scientificName: "Sorghum bicolor", ecoCropId: 48747,
    optimalTemperatureC: [22, 35], absoluteTemperatureC: [8, 40],
    optimalAnnualRainfallMm: [400, 600], absoluteAnnualRainfallMm: [300, 700],
    soilDepth: "Medium (50–150 cm) optimal and absolute",
    soilTexture: "Heavy/medium optimal; wide absolute range",
    soilFertility: "High optimal; low absolute",
    soilPhOptimal: [5.5, 7.5], soilPhAbsolute: [5, 8],
    drainage: "Well-drained optimal; well or excessive drainage in absolute range",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=48747",
    notes: "Sorghum types and varieties differ. The source's annual rainfall range is an ecological reference, not a local yield forecast.",
  },
  {
    crop: "Pearl millet", scientificName: "Pennisetum glaucum", ecoCropId: 8418,
    optimalTemperatureC: [25, 35], absoluteTemperatureC: [12, 40],
    optimalAnnualRainfallMm: [400, 900], absoluteAnnualRainfallMm: [200, 1700],
    soilDepth: "Deep (>150 cm) optimal; medium (50–150 cm) absolute",
    soilTexture: "Medium/light optimal and absolute",
    soilFertility: "Moderate optimal; low absolute",
    soilPhOptimal: [5, 6.5], soilPhAbsolute: [4.5, 8.3],
    drainage: "Well-drained optimal; well or excessive drainage in absolute range",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=8418",
    notes: "Pearl millet record only; this should not be reused for finger millet or other species.",
  },
  {
    crop: "Groundnut", scientificName: "Arachis hypogaea", ecoCropId: 2199,
    optimalTemperatureC: [22, 32], absoluteTemperatureC: [10, 45],
    optimalAnnualRainfallMm: [600, 1500], absoluteAnnualRainfallMm: [400, 4000],
    soilDepth: "Medium (50–150 cm) optimal and absolute",
    soilTexture: "Medium optimal; heavy/medium/light/organic absolute",
    soilFertility: "High optimal; moderate absolute",
    soilPhOptimal: [5.5, 6.5], soilPhAbsolute: [4.5, 8.5],
    drainage: "Good drainage is important for pod development and harvest",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=2199",
    notes: "Soil structure, calcium, aflatoxin prevention, harvest weather and cultivar are not covered by this screen.",
  },
  {
    crop: "Tomato", scientificName: "Lycopersicon esculentum (Solanum lycopersicum)", ecoCropId: 1379,
    optimalTemperatureC: [20, 27], absoluteTemperatureC: [7, 35],
    optimalAnnualRainfallMm: [600, 1300], absoluteAnnualRainfallMm: [400, 1800],
    soilDepth: "Shallow (20–50 cm)",
    soilTexture: "Optimal medium/organic; absolute heavy/medium/light",
    soilFertility: "Optimal high; absolute moderate",
    soilPhOptimal: [5.5, 6.8], soilPhAbsolute: [5, 7.5],
    drainage: "Well drained with dry spells",
    sourceUrl: "https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=1379",
    notes: "Temperature extremes, relative humidity, diurnal range, irrigation and protected cultivation alter field performance.",
  },
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

function evaluateFit(
  value: number | null,
  optimalRange: [number, number],
  absoluteRange: [number, number],
): ClimateFit {
  if (value === null) return "unknown";
  if (value >= optimalRange[0] && value <= optimalRange[1]) return "within_optimal_range";
  if (value >= absoluteRange[0] && value <= absoluteRange[1]) return "within_absolute_range_only";
  return "outside_absolute_range";
}

export async function assessLandClimate(point: GeoPoint, signal?: AbortSignal): Promise<LandClimateAssessment> {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90
    || !Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) {
    throw new Error("Valid WGS84 latitude and longitude are required.");
  }

  const climateUrl = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  climateUrl.searchParams.set("parameters", "T2M,PRECTOTCORR");
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
  const temperatureMonths = MONTHS.map((month, index) => ({ value: meanTemps[month], days: DAYS_IN_MONTH[index] }));
  const annualMeanTemperatureC = temperatureMonths.every((month) => month.value !== null)
    ? temperatureMonths.reduce((sum, month) => sum + (month.value ?? 0) * month.days, 0)
      / temperatureMonths.reduce((sum, month) => sum + month.days, 0)
    : null;

  // POWER's monthly PRECTOTCORR climatology is a mean daily precipitation
  // rate (mm/day). Convert each monthly rate to a monthly climatological total.
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
    const temperatureFit = evaluateFit(
      annualMeanTemperatureC,
      reference.optimalTemperatureC,
      reference.absoluteTemperatureC,
    );
    const rainfallFit = evaluateFit(
      estimatedAnnualRainfallMm,
      reference.optimalAnnualRainfallMm,
      reference.absoluteAnnualRainfallMm,
    );
    const climateScreen: ClimateFit = temperatureFit === "unknown" || rainfallFit === "unknown"
      ? "unknown"
      : temperatureFit === "outside_absolute_range" || rainfallFit === "outside_absolute_range"
        ? "outside_absolute_range"
        : temperatureFit === "within_optimal_range" && rainfallFit === "within_optimal_range"
          ? "within_optimal_range"
          : "within_absolute_range_only";

    return {
      crop: reference.crop,
      temperatureFit,
      rainfallFit,
      climateScreen,
      reference,
      explanation: climateScreen === "within_optimal_range"
        ? "The available long-term annual climate indicators fall inside the FAO EcoCrop species-level optimal reference intervals. This does not establish parcel suitability or expected yield."
        : climateScreen === "within_absolute_range_only"
          ? "At least one annual climate indicator falls outside the EcoCrop optimal interval but remains within the species-level absolute reference interval. This warrants local agronomic review."
          : climateScreen === "outside_absolute_range"
            ? "At least one annual climate indicator is outside the EcoCrop absolute reference interval. Local irrigation, protected cultivation, cultivars and seasonal exposure may change the practical result."
            : "One or more climate indicators are unavailable, so this crop cannot be screened reliably.",
    };
  });

  const unavailableEvidence = [
    "Soil pH, texture, organic carbon, nutrient status and rooting depth: no current field or point-level soil test is attached to this assessment.",
    "SoilGrids REST service is temporarily paused; no synthetic soil values are substituted.",
    "FAO GAEZ v5 gridded crop-suitability rasters have not yet been ingested into AgroClimate.",
    "Parcel slope, aspect, field-scale drainage, protected-area status, water rights, land tenure and road access were not assessed.",
    "Crop cultivar, planting date, pest pressure, irrigation availability and local agronomic extension advice were not supplied.",
    "Annual climate normals do not resolve the timing of temperature/rainfall during crop establishment, flowering and harvest.",
  ];
  if (elevationM === null) unavailableEvidence.push("Copernicus GLO-90 elevation query was unavailable for this point.");

  const temperatureUnits = String(climatePayload?.parameters?.T2M?.units || "°C");
  const precipitationUnits = String(climatePayload?.parameters?.PRECTOTCORR?.units || "mm/day");
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
    temperatureUnits,
    precipitationUnits,
    cropScreens,
    assessmentType: "preliminary_climate_screen_only",
    sources: [
      {
        name: "NASA POWER Climatology API",
        url: climateUrl.toString(),
        observationPeriod: "Long-term climatology; source response metadata defines product period",
        spatialResolution: "Gridded climate data; not a field-scale weather or soil measurement",
        limitations: "Long-term annual/monthly normals, not current observations, seasonal forecast, local microclimate or crop-stage weather. Rainfall annual total is estimated from monthly mean daily climatology rates.",
      },
      {
        name: "FAO EcoCrop species data sheets",
        url: "https://ecocrop.apps.fao.org/ecocrop/srv/en/cropListDetails",
        observationPeriod: "Species-level ecological reference data; source compilation dates vary",
        spatialResolution: "No local raster resolution; broad species reference ranges",
        limitations: "FAO EcoCrop values are screening references and may have uneven source quality. They are not locally calibrated cultivar prescriptions or a full land suitability classification.",
      },
      {
        name: "Copernicus DEM GLO-90 via Open-Meteo Elevation API",
        url: elevationUrl.toString(),
        observationPeriod: "Copernicus DEM GLO-90",
        spatialResolution: "90 m",
        limitations: "Point elevation only; does not calculate parcel slope, drainage or flood depth.",
      },
    ],
    unavailableEvidence,
    confidence: "low",
    assessedAt: new Date().toISOString(),
  };
}
