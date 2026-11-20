import { describe, expect, it } from "vitest";
import { normalizeInventoryRecord } from "@/hooks/useInventory";

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
