export type IndexReading = {
  ndvi: number | null;
  ndmi: number | null;
  ndwi: number | null;
};

export type FieldInterpretation = {
  vegetation: string;
  canopyMoisture: string;
  surfaceWater: string;
  combinedSignal: string;
  possibleExplanations: string[];
  fieldChecks: string[];
};

export function interpretFieldIndices(readings: IndexReading): FieldInterpretation {
  const { ndvi, ndmi, ndwi } = readings;

  const vegetation = ndvi === null
    ? "There are not enough valid pixels to interpret vegetation in this observation."
    : ndvi >= 0.5
      ? "The image shows a clear vegetation-greenness signal. This is not a measurement of yield or proof that the crop is healthy."
      : ndvi >= 0.25
        ? "The image shows a moderate vegetation signal. Crop type, planting date and growth stage are important before judging this value."
        : "The image shows sparse vegetation or exposed non-vegetated surfaces. This can be normal after planting or harvest, as well as during crop stress.";

  const canopyMoisture = ndmi === null
    ? "No valid canopy-moisture reading is available."
    : ndmi >= 0.3
      ? "The canopy-moisture signal is relatively strong in this observation."
      : ndmi >= 0.1
        ? "The canopy-moisture signal is intermediate. Compare it with earlier observations from the same field."
        : "The canopy-moisture signal is relatively low. This can accompany dry canopy conditions, but it does not measure water in the soil.";

  const surfaceWater = ndwi === null
    ? "No valid surface-water reading is available."
    : ndwi >= 0.3
      ? "The index suggests a stronger open-water or wet-surface signal. Check whether water is expected in this part of the field."
      : ndwi >= 0
        ? "The surface-water signal is not especially strong. Small wet patches may still be present."
        : "The image has a relatively weak open-water signal. This does not establish that the root zone is dry.";

  let combinedSignal = "Use this observation as a dated snapshot. A change from the same field's previous clear images is more informative than a single index value.";
  if (ndvi !== null && ndmi !== null && ndvi < 0.35 && ndmi < 0.1) {
    combinedSignal = "Both greenness and canopy-moisture signals are low. This may reflect early growth, a recently harvested field, sparse vegetation or crop stress. Compare with the crop calendar and previous images before drawing a conclusion.";
  } else if (ndvi !== null && ndmi !== null && ndvi >= 0.35 && ndmi < 0.1) {
    combinedSignal = "Vegetation is visible, but its canopy-moisture signal is relatively low. Check soil moisture near the roots and review recent rainfall and irrigation.";
  } else if (ndvi !== null && ndwi !== null && ndvi < 0.35 && ndwi >= 0.3) {
    combinedSignal = "A weak vegetation signal and stronger surface-water signal occur together. Check for flooding, waterlogging, recently cleared land or water features within the field boundary.";
  }

  const possibleExplanations = [
    "Normal crop-stage change, such as emergence, senescence or harvest.",
    "Water stress, nutrient limitation, pests or disease.",
    "Cloud, haze, shadow, mixed pixels or an imperfect field boundary.",
    "Farm activity, land clearing, flooding or another surface change.",
  ];

  const fieldChecks = [
    "Visit the affected part of the field and compare it with a healthy part of the same crop.",
    "Check soil moisture around the root zone and review irrigation and recent rainfall.",
    "Inspect leaves and stems for pests, disease symptoms, nutrient deficiency or physical damage.",
    "Confirm the crop type, planting date and growth stage; record a geotagged photo for follow-up.",
  ];

  return { vegetation, canopyMoisture, surfaceWater, combinedSignal, possibleExplanations, fieldChecks };
}

export type VegetationAlertInterpretation = {
  observedChange: string;
  likelyMeaning: string;
  checks: string[];
};

export function interpretVegetationAlert(input: {
  baselineNdvi: number | null;
  currentNdvi: number | null;
  baselineNdmi: number | null;
  currentNdmi: number | null;
}): VegetationAlertInterpretation {
  const { baselineNdvi, currentNdvi, baselineNdmi, currentNdmi } = input;
  if (baselineNdvi === null || currentNdvi === null) {
    return {
      observedChange: "The system does not have enough NDVI values to describe this change.",
      likelyMeaning: "Treat this alert as an observation requiring verification.",
      checks: ["Inspect the field and check the observation date and image quality."],
    };
  }

  const drop = baselineNdvi - currentNdvi;
  const percent = baselineNdvi > 0 ? (drop / baselineNdvi) * 100 : 0;
  const moistureDrop = baselineNdmi !== null && currentNdmi !== null
    ? baselineNdmi - currentNdmi
    : null;
  const corroborated = moistureDrop !== null && moistureDrop >= 0.08;

  const observedChange = `Mean NDVI changed from ${baselineNdvi.toFixed(2)} to ${currentNdvi.toFixed(2)} (${percent.toFixed(0)}% lower than the recent field baseline).${corroborated ? ` NDMI also fell by ${moistureDrop!.toFixed(2)}.` : ""}`;
  const likelyMeaning = corroborated
    ? "Greenness and canopy-moisture signals both declined. Water stress is one possibility, but crop stage, pests, disease, harvest and image conditions can also contribute."
    : "Greenness declined, but the moisture index does not independently confirm water-related stress. Crop stage, harvest, pests, disease or image conditions may explain the change.";

  return {
    observedChange,
    likelyMeaning,
    checks: [
      "Visit the field before taking action; inspect both affected and unaffected sections.",
      "Check root-zone moisture, irrigation delivery and recent rainfall.",
      "Look for pest damage, leaf spots, yellowing, wilting or recent harvesting.",
      "Compare with a field photo and another clear satellite observation before applying inputs.",
    ],
  };
}
