export type VegetationChangeInput = {
  baselineNdvi: number;
  currentNdvi: number;
  baselineNdmi: number | null;
  currentNdmi: number | null;
  minimumDrop: number;
  cloudCover: number | null;
};

export type VegetationChangeAssessment = {
  isAnomaly: boolean;
  severity: "moderate" | "high" | null;
  ndviDrop: number;
  ndviDropPercent: number;
  ndmiDrop: number | null;
  corroboratedByNdmi: boolean;
  confidence: number;
};

export function median(values: number[]): number {
  if (!values.length) throw new Error("Cannot calculate median of an empty series.");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function assessVegetationChange(input: VegetationChangeInput): VegetationChangeAssessment {
  const ndviDrop = input.baselineNdvi - input.currentNdvi;
  const ndviDropPercent = input.baselineNdvi > 0 ? (ndviDrop / input.baselineNdvi) * 100 : 0;
  const ndmiDrop = input.baselineNdmi === null || input.currentNdmi === null
    ? null
    : input.baselineNdmi - input.currentNdmi;
  const corroboratedByNdmi = ndmiDrop !== null && ndmiDrop >= 0.08;
  const isAnomaly = ndviDrop >= input.minimumDrop && ndviDropPercent >= 20;
  const severity = !isAnomaly ? null
    : ndviDrop >= 0.25 || (corroboratedByNdmi && ndviDrop >= 0.18) ? "high"
    : "moderate";
  const confidence = !isAnomaly ? 0 : Math.min(
    92,
    60 + (corroboratedByNdmi ? 20 : 0) + (input.cloudCover !== null && input.cloudCover <= 15 ? 10 : 0),
  );
  return { isAnomaly, severity, ndviDrop, ndviDropPercent, ndmiDrop, corroboratedByNdmi, confidence };
}
