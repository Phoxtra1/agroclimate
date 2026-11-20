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

export function validateInventoryRecord(table: InventoryTable, data: Record<string, unknown>, isUpdate = false): string | null {
  for (const field of REQUIRED_TEXT[table]) {
    if ((!isUpdate || field in data) && (typeof data[field] !== "string" || !String(data[field]).trim())) {
      return `${field.replaceAll("_", " ")} is required.`;
    }
  }
  for (const field of NON_NEGATIVE_NUMBERS[table] || []) {
    if (!(field in data)) continue;
    const value = Number(data[field]);
    if (!Number.isFinite(value) || value < 0) return `${field.replaceAll("_", " ")} must be a valid non-negative number.`;
  }
  for (const field of POSITIVE_NUMBERS[table] || []) {
    if (!(field in data)) continue;
    const value = Number(data[field]);
    if (!Number.isFinite(value) || value <= 0) return `${field.replaceAll("_", " ")} must be greater than zero.`;
  }
  if (table === "labor_records" && "worker_count" in data && !Number.isInteger(Number(data.worker_count))) {
    return "Worker count must be a whole number.";
  }
  return null;
}
