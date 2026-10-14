import { z } from "zod";

export type ScanMode = "visual" | "strip";

// Level 1: Primary Categories
export type PrimaryOutcome = "looks_fresh" | "caution" | "do_not_eat" | "inconclusive";

export const primaryOutcomeLabels: Record<PrimaryOutcome, string> = {
  looks_fresh: "Looks Fresh",
  caution: "Caution",
  do_not_eat: "Do Not Eat",
  inconclusive: "Inconclusive",
};

export const primaryOutcomeDescriptions: Record<PrimaryOutcome, string> = {
  looks_fresh: "No visible rot, heavy bruising, or mould growth detected on surface.",
  caution: "Visible defects, minor discoloration, or initial ripening/bruising observed. Monitor closely.",
  do_not_eat: "Visible rot, mould growth, or severe physical degradation detected. Unsafe for consumption.",
  inconclusive: "Visual inspection could not reliably evaluate the produce (poor lighting, blur, or obstruction).",
};

// Supported produce types for initial Level 1 scanner
export const SUPPORTED_PRODUCE_TYPES = [
  { id: "mango", label: "Mangoes", icon: "🥭", description: "Evaluates surface peel discoloration, sap burn, black rot (anthracnose), softness, and skin firmness." },
  { id: "banana", label: "Bananas", icon: "🍌", description: "Evaluates peel browning, crown rot, skin integrity, fruit firmness, and fungal spots." },
  { id: "plantain", label: "Plantains", icon: "🍌", description: "Evaluates peel starch-to-sugar transition, tip mold, mechanical splitting, and pulp bruising." },
] as const;

export type SupportedProduceId = typeof SUPPORTED_PRODUCE_TYPES[number]["id"] | "other";

// Level 2: Compatibility States
export type CompatibilityState = "SUPPORTED" | "NOT_YET_VALIDATED" | "UNSUPPORTED" | "INCONCLUSIVE";

export const compatibilityStateLabels: Record<CompatibilityState, string> = {
  SUPPORTED: "SUPPORTED",
  NOT_YET_VALIDATED: "NOT YET VALIDATED",
  UNSUPPORTED: "UNSUPPORTED",
  INCONCLUSIVE: "INCONCLUSIVE",
};

export const compatibilityStateBadges: Record<CompatibilityState, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SUPPORTED: { label: "Supported Test", variant: "default" },
  NOT_YET_VALIDATED: { label: "Not Yet Validated", variant: "secondary" },
  UNSUPPORTED: { label: "Unsupported Card Format", variant: "outline" },
  INCONCLUSIVE: { label: "Inconclusive Reading", variant: "destructive" },
};

// Schema for API and Local Storage scan results
export const scanResultSchema = z.object({
  outcome: z.enum(["looks_fresh", "caution", "do_not_eat", "inconclusive", "no_visible_concern", "concern", "reference_match"]),
  confidence: z.enum(["low", "moderate", "high"]),
  produce: z.string().max(160),
  summary: z.string().max(1200),
  observations: z.array(z.string().max(500)).max(10),
  actions: z.array(z.string().max(500)).max(10),
  referenceReading: z.string().max(800).nullable().optional(),
  // Extended Level 1 fields
  ripenessStage: z.string().optional(),
  visibleDefects: z.array(z.string()).optional(),
  distinctions: z.object({
    visibleEvidence: z.array(z.string()),
    inferredConclusions: z.array(z.string()),
  }).optional(),
  // Extended Level 2 fields
  testCardId: z.string().optional(),
  testCardName: z.string().optional(),
  compatibilityState: z.enum(["SUPPORTED", "NOT_YET_VALIDATED", "UNSUPPORTED", "INCONCLUSIVE"]).optional(),
  detectedSubstance: z.string().optional(),
  interpretedValue: z.string().optional(),
  readingQuality: z.string().optional(),
  deltaE: z.number().optional(),
  chemicalDisclaimer: z.string().optional(),
});

export type ScanResult = z.infer<typeof scanResultSchema>;

export type ScanRecord = {
  id: string;
  mode: ScanMode;
  at: string;
  label: string;
  produceType?: string;
  result: ScanResult;
  imageSnippet?: string; // thumbnail / data url
  referenceSnippet?: string;
};

// Test Configuration Structure for Level 2
export interface ReferenceSwatch {
  id: string;
  label: string;
  hexColor: string;
  rgb: [number, number, number];
  valueString: string;
  category: "safe" | "caution" | "danger" | "inconclusive";
  thresholdPpm?: number;
}

export interface TestCardConfig {
  id: string;
  name: string;
  manufacturer: string;
  targetSubstance: string;
  substanceClass: string;
  supportedProduce: string[];
  samplePrepInstructions: string[];
  requiredReactionTimeSeconds: number;
  cardLayoutDescription: string;
  referenceSwatches: ReferenceSwatch[];
  interpretationRules: string;
  detectionLimits: string;
  knownLimitations: string[];
  validationStatus: "operational" | "experimental";
  compatibilityState: CompatibilityState;
}

// Developer Calibration & Evaluation Record
export interface EvaluationRecord {
  id: string;
  testConfigId: string;
  testConfigName: string;
  timestamp: string;
  expectedResult: string;
  actualResult: string;
  deltaE: number;
  match: boolean;
  notes: string;
  validationStatus: "operational" | "experimental";
  imageDataUrl?: string;
}

// Pre-built Operational & Experimental Test Configurations
export const DEFAULT_TEST_CONFIGS: TestCardConfig[] = [
  {
    id: "agrocard-pest-01",
    name: "AgroCard Rapid Pesticide Screen v2",
    manufacturer: "AgroBio Diagnostics",
    targetSubstance: "Organophosphate & Carbamate Residues",
    substanceClass: "Cholinesterase Inhibitors",
    supportedProduce: ["Mangoes", "Bananas", "Plantains", "Leafy Vegetables", "Tomatoes"],
    samplePrepInstructions: [
      "Cut a small piece of produce skin (approx 2cm x 2cm).",
      "Crush skin in 5ml buffer solution for 60 seconds.",
      "Apply 3 drops of liquid extract onto the circular reaction pad.",
      "Wait exactly 120 seconds before photographing."
    ],
    requiredReactionTimeSeconds: 120,
    cardLayoutDescription: "Single white reaction pad on left with 4-level color reference bar on right.",
    referenceSwatches: [
      { id: "s1", label: "Negative (No Detection)", hexColor: "#3b82f6", rgb: [59, 130, 246], valueString: "< 0.01 mg/kg (MRL Compliant)", category: "safe", thresholdPpm: 0.01 },
      { id: "s2", label: "Trace Detection", hexColor: "#10b981", rgb: [16, 185, 129], valueString: "0.01 - 0.1 mg/kg (Low Trace)", category: "caution", thresholdPpm: 0.1 },
      { id: "s3", label: "Moderate Detection", hexColor: "#eab308", rgb: [234, 179, 8], valueString: "0.1 - 0.5 mg/kg (Exceeds MRL Threshold)", category: "danger", thresholdPpm: 0.5 },
      { id: "s4", label: "High Hazard", hexColor: "#ef4444", rgb: [239, 68, 68], valueString: "> 0.5 mg/kg (High Residue Detected)", category: "danger", thresholdPpm: 1.0 }
    ],
    interpretationRules: "Blue hue indicates uninhibited enzyme (safe). Transition from yellow to dark red indicates high cholinesterase inhibition (chemical residue presence).",
    detectionLimits: "Limit of Detection (LOD): 0.01 mg/kg for Chlorpyrifos and Methomyl.",
    knownLimitations: [
      "Does not detect synthetic pyrethroids, neonicotinoids, or fungicides.",
      "High citrus acidity or ascorbic acid may delay reaction time.",
      "Uncalibrated phone camera readings require stable natural lighting."
    ],
    validationStatus: "operational",
    compatibilityState: "SUPPORTED",
  },
  {
    id: "qualisafe-nitrate-02",
    name: "QualiSafe Food Nitrate / Nitrite Strip",
    manufacturer: "QualiChem Sensor Tech",
    targetSubstance: "Nitrate (NO3-) & Nitrite (NO2-)",
    substanceClass: "Inorganic Nitrogenous Compounds / Synthetic Fertilizers",
    supportedProduce: ["Mangoes", "Bananas", "Plantains", "Tubers"],
    samplePrepInstructions: [
      "Press fresh produce pulp gently against the dual reaction test square.",
      "Ensure pulp moisture fully wets both square pads.",
      "Wait exactly 60 seconds."
    ],
    requiredReactionTimeSeconds: 60,
    cardLayoutDescription: "Dual pad paper strip: Top pad = Nitrate, Bottom pad = Nitrite.",
    referenceSwatches: [
      { id: "n1", label: "Normal Level", hexColor: "#fde047", rgb: [253, 224, 71], valueString: "< 50 mg/kg (Normal)", category: "safe", thresholdPpm: 50 },
      { id: "n2", label: "Elevated Level", hexColor: "#f97316", rgb: [249, 115, 22], valueString: "50 - 250 mg/kg (Elevated)", category: "caution", thresholdPpm: 250 },
      { id: "n3", label: "High Accumulation", hexColor: "#dc2626", rgb: [220, 38, 38], valueString: "> 250 mg/kg (High Fertilizer Accumulation)", category: "danger", thresholdPpm: 500 }
    ],
    interpretationRules: "Yellow hue is normal. Deep pink or violet indicates excessive nitrate accumulation from over-fertilization.",
    detectionLimits: "LOD: 10 mg/kg NO3-.",
    knownLimitations: [
      "Sensitive to direct sunlight during incubation.",
      "Extremely dried produce samples must be rehydrated with distilled water."
    ],
    validationStatus: "operational",
    compatibilityState: "SUPPORTED",
  },
  {
    id: "biodetect-peroxide-exp",
    name: "BioDetect Peroxide & Ripening Agent Card",
    manufacturer: "BioDetect Inc.",
    targetSubstance: "Calcium Carbide / Industrial Peroxide Residue",
    substanceClass: "Forced Ripening Chemicals",
    supportedProduce: ["Mangoes", "Bananas", "Plantains"],
    samplePrepInstructions: [
      "Swab fruit surface peel with provided wet microfiber swab.",
      "Press swab firmly onto card reaction window.",
      "Wait 45 seconds."
    ],
    requiredReactionTimeSeconds: 45,
    cardLayoutDescription: "Circular indicator window with gradient reference ring.",
    referenceSwatches: [
      { id: "p1", label: "Negative", hexColor: "#f3f4f6", rgb: [243, 244, 246], valueString: "No artificial peroxide detected", category: "safe" },
      { id: "p2", label: "Suspected Artificial Ripening", hexColor: "#a855f7", rgb: [168, 85, 247], valueString: "Positive artificial ripening chemical trace", category: "danger" }
    ],
    interpretationRules: "Color change to purple indicates chemical oxidizing agents commonly used in artificial forced ripening.",
    detectionLimits: "Qualitative indicator (Positive / Negative).",
    knownLimitations: [
      "Experimental configuration under validation.",
      "Natural fruit peroxidase in damaged peel can occasionally cause mild false positives."
    ],
    validationStatus: "experimental",
    compatibilityState: "NOT_YET_VALIDATED",
  },
  {
    id: "unsupported-custom-card",
    name: "Unrecognized / Custom Chemical Card",
    manufacturer: "Unknown Manufacturer",
    targetSubstance: "Unspecified Chemical Compound",
    substanceClass: "Unknown",
    supportedProduce: ["All Produce"],
    samplePrepInstructions: ["Photograph card next to produce for documentation."],
    requiredReactionTimeSeconds: 0,
    cardLayoutDescription: "Unrecognized layout",
    referenceSwatches: [],
    interpretationRules: "Automatic interpretation unavailable for unvalidated formats.",
    detectionLimits: "N/A",
    knownLimitations: ["Requires manual configuration by an authorized administrator."],
    validationStatus: "experimental",
    compatibilityState: "UNSUPPORTED",
  }
];

// Frame Quality Assessment for live camera feed
export function frameQuality(data: Uint8ClampedArray, previous?: Uint8ClampedArray) {
  let brightness = 0, motion = 0, edges = 0;
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i] + data[i + 1] + data[i + 2]) / 3;
    brightness += value;
    if (previous?.length === data.length) motion += Math.abs(value - (previous[i] + previous[i + 1] + previous[i + 2]) / 3);
    if (i >= 4) edges += Math.abs(value - (data[i - 4] + data[i - 3] + data[i - 2]) / 3);
  }
  const light = brightness / count;
  const lit = light > 45 && light < 225;
  const steady = !!previous && motion / count < 7;
  const detail = edges / count > 5;

  return { lit, steady, detail, lightScore: Math.round(light) };
}

// Color Analysis Utilities (RGB Euclidean & DeltaE CIE76)
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Simple RGB to Lab conversion for accurate perceptual color distance
  let rN = r / 255, gN = g / 255, bN = b / 255;
  rN = rN > 0.04045 ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
  gN = gN > 0.04045 ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
  bN = bN > 0.04045 ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;

  let x = (rN * 0.4124 + gN * 0.3576 + bN * 0.1805) * 100;
  let y = (rN * 0.2126 + gN * 0.7152 + bN * 0.0722) * 100;
  let z = (rN * 0.0193 + gN * 0.1192 + bN * 0.9505) * 100;

  x /= 95.047; y /= 100.0; z /= 108.883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

  const l = (116 * y) - 16;
  const a = 500 * (x - y);
  const bVal = 200 * (y - z);

  return [l, a, bVal];
}

export function calculateDeltaE(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lab1 = rgbToLab(...rgb1);
  const lab2 = rgbToLab(...rgb2);
  const dL = lab1[0] - lab2[0];
  const dA = lab1[1] - lab2[1];
  const dB = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + dA * dA + dB * dB);
}

// Client-side Test Card Zone Color Extraction & Analysis
export function analyzeCardImageColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: TestCardConfig
): {
  matchedSwatch: ReferenceSwatch | null;
  deltaE: number;
  extractedRgb: [number, number, number];
  quality: "good" | "poor_lighting" | "blurry" | "invalid_card";
  qualityMessage: string;
} {
  // Sample center area (20% x 20% in center) of the uploaded image
  const sampleX = Math.floor(width * 0.4);
  const sampleY = Math.floor(height * 0.4);
  const sampleW = Math.floor(width * 0.2);
  const sampleH = Math.floor(height * 0.2);

  if (sampleW <= 0 || sampleH <= 0) {
    return {
      matchedSwatch: null,
      deltaE: 999,
      extractedRgb: [0, 0, 0],
      quality: "invalid_card",
      qualityMessage: "Card image area too small or invalid.",
    };
  }

  const imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
  const data = imgData.data;

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    count++;
  }

  const avgR = Math.round(sumR / count);
  const avgG = Math.round(sumG / count);
  const avgB = Math.round(sumB / count);
  const extractedRgb: [number, number, number] = [avgR, avgG, avgB];

  // Assess lighting quality
  const brightness = (avgR + avgG + avgB) / 3;
  if (brightness < 30) {
    return {
      matchedSwatch: null,
      deltaE: 999,
      extractedRgb,
      quality: "poor_lighting",
      qualityMessage: "Image too dark. Move to a well-lit area with direct white or natural light.",
    };
  }
  if (brightness > 240) {
    return {
      matchedSwatch: null,
      deltaE: 999,
      extractedRgb,
      quality: "poor_lighting",
      qualityMessage: "Image overexposed / glare detected. Avoid direct spotlight glare on test pads.",
    };
  }

  if (config.referenceSwatches.length === 0) {
    return {
      matchedSwatch: null,
      deltaE: 999,
      extractedRgb,
      quality: "invalid_card",
      qualityMessage: "Selected test card has no configured reference swatches.",
    };
  }

  // Find closest swatch using CIE76 DeltaE
  let minDeltaE = Infinity;
  let bestSwatch: ReferenceSwatch | null = null;

  for (const swatch of config.referenceSwatches) {
    const dist = calculateDeltaE(extractedRgb, swatch.rgb);
    if (dist < minDeltaE) {
      minDeltaE = dist;
      bestSwatch = swatch;
    }
  }

  return {
    matchedSwatch: bestSwatch,
    deltaE: Math.round(minDeltaE * 10) / 10,
    extractedRgb,
    quality: "good",
    qualityMessage: "Card color response successfully analyzed against reference configuration.",
  };
}

// Client image preparation helper
export async function prepareScanImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP photo.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Choose a photo smaller than 12 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("This photo could not be opened.");
    }
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Photo processing is unavailable on this device.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
