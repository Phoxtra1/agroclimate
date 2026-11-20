import { describe, expect, it } from "vitest";
import { validateInventoryRecord } from "@/lib/inventoryValidation";
import { normalizeInventoryRecord } from "@/hooks/useInventory";

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

  it("rejects empty, null and boolean values instead of treating them as zero", () => {
    for (const value of ["", "   ", null, false]) {
      expect(validateInventoryRecord("inventory_items", {
        item_name: "Fertilizer", item_type: "input", unit: "bag", price_per_unit: value,
      })).toContain("valid non-negative number");
    }
  });

  it("continues to accept numeric strings and explicit zero-cost inputs", () => {
    expect(validateInventoryRecord("inventory_items", {
      item_name: "Family-saved seed", item_type: "seed", unit: "kg", quantity: "0", price_per_unit: "0",
    })).toBeNull();
  });

  it("allows partial updates without requiring omitted fields", () => {
    expect(validateInventoryRecord("inventory_items", { quantity: 12 }, true)).toBeNull();
    expect(validateInventoryRecord("inventory_items", { quantity: -2 }, true)).toContain("non-negative");
  });
});



describe("Agro Inventory record validation", () => {
  it("normalizes numeric values and removes forged ownership metadata", () => {
    const payload = normalizeInventoryRecord("inventory_items", {
      item_name: "Maize seed", item_type: "seed", quantity: "12.5", price_per_unit: "4",
      user_id: "forged-user", id: "forged-id", created_at: "forged-date",
    }, true);
    expect(payload).toEqual({
      item_name: "Maize seed", item_type: "seed", quantity: 12.5, price_per_unit: 4,
    });
  });

  it("requires mandatory text and numeric values for every record category", () => {
    expect(() => normalizeInventoryRecord("inventory_items", {
      item_name: " ", item_type: "seed", quantity: 2, price_per_unit: 3,
    }, true)).toThrow("item name is required");
    expect(() => normalizeInventoryRecord("labor_records", {
      task_description: "Weeding", worker_count: 2, days_worked: 3,
    }, true)).toThrow("cost per day is required");
    expect(() => normalizeInventoryRecord("land_costs", {
      land_description: "North plot", cost_type: "rent", size_acres: 1,
    }, true)).toThrow("cost amount is required");
    expect(() => normalizeInventoryRecord("harvest_records", {
      crop_name: "Maize",
    }, true)).toThrow("quantity is required");
    expect(() => normalizeInventoryRecord("harvest_losses", {
      crop_name: "Maize", loss_reason: "Spoilage",
    }, true)).toThrow("quantity lost is required");
    expect(() => normalizeInventoryRecord("sales_records", {
      crop_name: "Maize", quantity_sold: 4,
    }, true)).toThrow("price per unit is required");
  });

  it("rejects negative and non-finite numeric values", () => {
    expect(() => normalizeInventoryRecord("inventory_items", {
      item_name: "Fertilizer", item_type: "input", quantity: "-1", price_per_unit: "2",
    }, true)).toThrow("quantity must be a non-negative number");
    expect(() => normalizeInventoryRecord("sales_records", {
      crop_name: "Maize", quantity_sold: "Infinity", price_per_unit: "2",
    }, true)).toThrow("quantity sold must be a non-negative number");
  });

  it("rejects zero production, sales, loss, worker and land quantities", () => {
    expect(() => normalizeInventoryRecord("harvest_records", { crop_name: "Maize", quantity: "0" }, true)).toThrow("quantity must be greater than zero");
    expect(() => normalizeInventoryRecord("sales_records", { crop_name: "Maize", quantity_sold: "0", price_per_unit: "10" }, true)).toThrow("quantity sold must be greater than zero");
    expect(() => normalizeInventoryRecord("harvest_losses", { crop_name: "Maize", loss_reason: "Spoilage", quantity_lost: "0" }, true)).toThrow("quantity lost must be greater than zero");
    expect(() => normalizeInventoryRecord("land_costs", { land_description: "Plot", cost_type: "rent", size_acres: "0", cost_amount: "100" }, true)).toThrow("size acres must be greater than zero");
    expect(() => normalizeInventoryRecord("labor_records", { task_description: "Weeding", worker_count: "0", days_worked: "2", cost_per_day: "20" }, true)).toThrow("worker count must be greater than zero");
  });

  it("requires whole worker counts while permitting zero-cost records", () => {
    expect(() => normalizeInventoryRecord("labor_records", {
      task_description: "Harvesting", worker_count: "1.5", days_worked: "2", cost_per_day: "50",
    }, true)).toThrow("Worker count must be a whole number");
    expect(() => normalizeInventoryRecord("labor_records", {
      task_description: "Family labor", worker_count: "2", days_worked: "1", cost_per_day: "0",
    }, true)).not.toThrow();
  });

  it("omits blank defaulted unit and date fields", () => {
    const payload = normalizeInventoryRecord("harvest_records", {
      crop_name: "Cassava", quantity: "5", unit: "", harvest_date: "",
    }, true);
    expect(payload).not.toHaveProperty("unit");
    expect(payload).not.toHaveProperty("harvest_date");
    expect(payload.quantity).toBe(5);
  });

  it("supports partial edits without allowing ownership or timestamp changes", () => {
    const payload = normalizeInventoryRecord("inventory_items", {
      quantity: "14", user_id: "another-user", created_at: "forged",
    }, false);
    expect(payload).toEqual({ quantity: 14 });
    expect(() => normalizeInventoryRecord("inventory_items", { quantity: "-2" }, false))
      .toThrow("quantity must be a non-negative number");
  });

  it("rejects invalid dates and empty edit payloads are detectable", () => {
    expect(() => normalizeInventoryRecord("sales_records", {
      sale_date: "not-a-date",
    }, false)).toThrow("sale date must be a valid date");
    expect(normalizeInventoryRecord("inventory_items", { user_id: "forged" }, false)).toEqual({});
  });
});
