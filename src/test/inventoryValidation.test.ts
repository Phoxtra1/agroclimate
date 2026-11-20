import { describe, expect, it } from "vitest";
import { normalizeInventoryRecord } from "@/hooks/useInventory";

describe("Agro Inventory record validation", () => {
  it("normalizes numeric input and strips ownership metadata", () => {
    const payload = normalizeInventoryRecord("inventory_items", {
      item_name: "Maize seed",
      item_type: "seed",
      quantity: "12.5",
      price_per_unit: "4",
      user_id: "forged-user",
      created_at: "forged-date",
    }, true);

    expect(payload).toEqual({
      item_name: "Maize seed",
      item_type: "seed",
      quantity: 12.5,
      price_per_unit: 4,
    });
  });

  it("rejects negative and non-finite quantities", () => {
    expect(() => normalizeInventoryRecord("inventory_items", {
      item_name: "Fertilizer", item_type: "fertilizer", quantity: "-1", price_per_unit: "2",
    }, true)).toThrow("quantity must be a non-negative number");

    expect(() => normalizeInventoryRecord("sales_records", {
      crop_name: "Maize", quantity_sold: "Infinity", price_per_unit: "2",
    }, true)).toThrow("quantity sold must be a non-negative number");
  });

  it("requires all required text and numeric fields for new records", () => {
    expect(() => normalizeInventoryRecord("labor_records", {
      task_description: "Weeding", worker_count: "2", days_worked: "3",
    }, true)).toThrow("cost per day is required");

    expect(() => normalizeInventoryRecord("harvest_records", {
      crop_name: "Maize", quantity: "10",
    }, true)).not.toThrow();
  });

  it("requires worker counts to be whole numbers", () => {
    expect(() => normalizeInventoryRecord("labor_records", {
      task_description: "Harvesting", worker_count: "1.5", days_worked: "2", cost_per_day: "50",
    }, true)).toThrow("Worker count must be a whole number");
  });

  it("omits an empty optional harvest date so the database default can apply", () => {
    const payload = normalizeInventoryRecord("harvest_records", {
      crop_name: "Cassava", quantity: "5", harvest_date: "",
    }, true);
    expect(payload).not.toHaveProperty("harvest_date");
    expect(payload.quantity).toBe(5);
  });
});
