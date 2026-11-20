export type InventoryTable =
  | "inventory_items"
  | "labor_records"
  | "land_costs"
  | "harvest_records"
  | "harvest_losses"
  | "sales_records";

const REQUIRED_TEXT: Record<InventoryTable, string[]> = {
  inventory_items: ["item_name", "item_type", "unit"],
  labor_records: ["task_description"],
  land_costs: ["land_description", "cost_type"],
  harvest_records: ["crop_name", "unit"],
  harvest_losses: ["crop_name", "loss_reason", "unit"],
  sales_records: ["crop_name", "unit"],
};

const NON_NEGATIVE_NUMBERS: Partial<Record<InventoryTable, string[]>> = {
  inventory_items: ["quantity", "price_per_unit"],
  labor_records: ["worker_count", "days_worked", "cost_per_day"],
  land_costs: ["size_acres", "cost_amount"],
  harvest_records: ["quantity"],
  harvest_losses: ["quantity_lost"],
  sales_records: ["quantity_sold", "price_per_unit"],
};

const POSITIVE_NUMBERS: Partial<Record<InventoryTable, string[]>> = {
  labor_records: ["worker_count", "days_worked"],
  land_costs: ["size_acres"],
  harvest_records: ["quantity"],
  harvest_losses: ["quantity_lost"],
  sales_records: ["quantity_sold"],
};

/**
 * Parse values originating from form fields or device adapters without JavaScript's
 * permissive coercions (for example, Number(true) === 1 and Number(" ") === 0).
 * Numeric strings remain supported for HTML input elements.
 */
export function parseInventoryNumericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateInventoryRecord(table: InventoryTable, data: Record<string, unknown>, isUpdate = false): string | null {
  for (const field of REQUIRED_TEXT[table]) {
    if ((!isUpdate || field in data) && (typeof data[field] !== "string" || !data[field].trim())) {
      return `${field.replace(/_/g, " ")} is required.`;
    }
  }
  for (const field of NON_NEGATIVE_NUMBERS[table] || []) {
    if (!(field in data)) continue;
    const value = parseInventoryNumericValue(data[field]);
    if (value === null || value < 0) return `${field.replace(/_/g, " ")} must be a valid non-negative number.`;
  }
  for (const field of POSITIVE_NUMBERS[table] || []) {
    if (!(field in data)) continue;
    const value = parseInventoryNumericValue(data[field]);
    if (value === null || value <= 0) return `${field.replace(/_/g, " ")} must be greater than zero.`;
  }
  if (table === "labor_records" && "worker_count" in data && !Number.isInteger(parseInventoryNumericValue(data.worker_count) ?? NaN)) {
    return "Worker count must be a whole number.";
  }
  return null;
}
