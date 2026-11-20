import { describe, expect, it } from "vitest";
import { validateInventoryRecord } from "@/lib/inventoryValidation";

describe("Agro Inventory record validation", () => {
  it("requires the core identity fields for stock inputs", () => {
    expect(validateInventoryRecord("inventory_items", { item_name: "", item_type: "seed", unit: "kg" })).toContain("item name is required");
    expect(validateInventoryRecord("inventory_items", { item_name: "Maize seed", item_type: "seed", unit: "kg", quantity: 10, price_per_unit: 5 })).toBeNull();
  });

  it("rejects negative or non-finite numeric values", () => {
    expect(validateInventoryRecord("inventory_items", { item_name: "Fertilizer", item_type: "input", unit: "bag", quantity: -1 })).toContain("non-negative");
    expect(validateInventoryRecord("sales_records", { crop_name: "Maize", unit: "kg", quantity_sold: Infinity })).toContain("valid non-negative");
  });

  it("requires positive production and sales quantities", () => {
    expect(validateInventoryRecord("harvest_records", { crop_name: "Cassava", unit: "kg", quantity: 0 })).toContain("greater than zero");
    expect(validateInventoryRecord("sales_records", { crop_name: "Maize", unit: "kg", quantity_sold: 4, price_per_unit: 0 })).toBeNull();
  });

  it("requires valid whole worker counts and positive land size", () => {
    expect(validateInventoryRecord("labor_records", { task_description: "Weeding", worker_count: 1.5, days_worked: 2, cost_per_day: 10 })).toContain("whole number");
    expect(validateInventoryRecord("land_costs", { land_description: "North plot", cost_type: "rent", size_acres: 0 })).toContain("greater than zero");
  });

  it("allows partial updates without requiring omitted fields", () => {
    expect(validateInventoryRecord("inventory_items", { quantity: 12 }, true)).toBeNull();
    expect(validateInventoryRecord("inventory_items", { quantity: -2 }, true)).toContain("non-negative");
  });
});
