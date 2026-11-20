export function validateHarvestEntry(input: {
  crop_name?: unknown;
  quantity?: unknown;
  unit?: unknown;
  harvest_date?: unknown;
}): string | null {
  if (typeof input.crop_name !== "string" || !input.crop_name.trim()) return "Crop name is required.";
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return "Harvest quantity must be greater than zero.";
  if (typeof input.unit !== "string" || !input.unit.trim()) return "Harvest unit is required.";
  if (typeof input.harvest_date !== "string" || !input.harvest_date || Number.isNaN(Date.parse(input.harvest_date))) {
    return "A valid harvest date is required.";
  }
  return null;
}
