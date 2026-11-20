import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface InventoryItem {
  id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  crop_name: string | null;
  season: string | null;
  farm_plot: string | null;
  notes: string | null;
}

export interface LaborRecord {
  id: string;
  task_description: string;
  worker_count: number;
  days_worked: number;
  cost_per_day: number;
  crop_name: string | null;
  season: string | null;
  farm_plot: string | null;
  notes: string | null;
}

export interface LandCost {
  id: string;
  land_description: string;
  size_acres: number;
  cost_type: string;
  cost_amount: number;
  season: string | null;
  farm_plot: string | null;
  notes: string | null;
}

export interface HarvestRecord {
  id: string;
  crop_name: string;
  quantity: number;
  unit: string;
  quality_grade: string | null;
  season: string | null;
  farm_plot: string | null;
  harvest_date: string | null;
  notes: string | null;
}

export interface HarvestLoss {
  id: string;
  crop_name: string;
  quantity_lost: number;
  unit: string;
  loss_reason: string;
  season: string | null;
  farm_plot: string | null;
  notes: string | null;
}

export interface SalesRecord {
  id: string;
  crop_name: string;
  quantity_sold: number;
  unit: string;
  price_per_unit: number;
  buyer_name: string | null;
  season: string | null;
  farm_plot: string | null;
  sale_date: string | null;
  notes: string | null;
}

export interface InventoryMetrics {
  totalInputsCost: number;
  totalLaborCost: number;
  totalLandCost: number;
  totalHarvestQty: number;
  totalLosses: number;
  totalRevenue: number;
  netProfit: number;
}

type InventoryTable = "inventory_items" | "labor_records" | "land_costs" | "harvest_records" | "harvest_losses" | "sales_records";

const INVENTORY_TABLES: InventoryTable[] = [
  "inventory_items", "labor_records", "land_costs", "harvest_records", "harvest_losses", "sales_records",
];

const NUMERIC_FIELDS: Record<InventoryTable, string[]> = {
  inventory_items: ["quantity", "price_per_unit"],
  labor_records: ["worker_count", "days_worked", "cost_per_day"],
  land_costs: ["size_acres", "cost_amount"],
  harvest_records: ["quantity"],
  harvest_losses: ["quantity_lost"],
  sales_records: ["quantity_sold", "price_per_unit"],
};

const REQUIRED_FIELDS: Record<InventoryTable, string[]> = {
  inventory_items: ["item_name", "item_type"],
  labor_records: ["task_description"],
  land_costs: ["land_description", "cost_type"],
  harvest_records: ["crop_name"],
  harvest_losses: ["crop_name", "loss_reason"],
  sales_records: ["crop_name"],
};

const DATE_FIELDS: Record<InventoryTable, string[]> = {
  inventory_items: [],
  labor_records: [],
  land_costs: [],
  harvest_records: ["harvest_date"],
  harvest_losses: [],
  sales_records: ["sale_date"],
};

function normalizeInventoryRecord(table: InventoryTable, data: Record<string, unknown>, requireFields: boolean) {
  const payload = { ...data };
  for (const key of ["id", "user_id", "created_at", "updated_at"]) delete payload[key];

  if (requireFields) {
    for (const field of REQUIRED_FIELDS[table]) {
      if (typeof payload[field] !== "string" || !(payload[field] as string).trim()) {
        throw new Error(`${field.replace(/_/g, " ")} is required.`);
      }
      payload[field] = (payload[field] as string).trim();
    }
  }

  for (const field of NUMERIC_FIELDS[table]) {
    if (!(field in payload)) continue;
    if (payload[field] === "" || payload[field] == null) {
      throw new Error(`${field.replace(/_/g, " ")} must be a non-negative number.`);
    }
    const value = Number(payload[field]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${field.replace(/_/g, " ")} must be a non-negative number.`);
    }
    if (field === "worker_count" && !Number.isInteger(value)) {
      throw new Error("Worker count must be a whole number.");
    }
    payload[field] = value;
  }

  for (const field of DATE_FIELDS[table]) {
    if (payload[field] === "") delete payload[field];
    else if (payload[field] != null && Number.isNaN(Date.parse(String(payload[field])))) {
      throw new Error(`${field.replace(/_/g, " ")} must be a valid date.`);
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.trim() === "") payload[key] = null;
  }
  return payload;
}

export function useInventory(filterSeason?: string, filterCrop?: string, filterPlot?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [laborRecords, setLaborRecords] = useState<LaborRecord[]>([]);
  const [landCosts, setLandCosts] = useState<LandCost[]>([]);
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [harvestLosses, setHarvestLosses] = useState<HarvestLoss[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const currentUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;

  const clearRecords = () => {
    setInventoryItems([]);
    setLaborRecords([]);
    setLandCosts([]);
    setHarvestRecords([]);
    setHarvestLosses([]);
    setSalesRecords([]);
  };

  const fetchAll = useCallback(async () => {
    const userId = user?.id;
    if ((userId ?? null) !== currentUserId.current) return;
    const version = ++requestVersion.current;
    if (!userId) {
      clearRecords();
      setLoading(false);
      return;
    }

    clearRecords();
    setLoading(true);
    try {
      const [inv, lab, land, harv, loss, sales] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("labor_records").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("land_costs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("harvest_records").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("harvest_losses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("sales_records").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      if (version !== requestVersion.current || userId !== currentUserId.current) return;

      const failures = [inv, lab, land, harv, loss, sales].filter((result) => result.error);
      if (failures.length) {
        toast({
          title: "Some inventory records could not be loaded",
          description: failures.map((result) => result.error?.message).filter(Boolean).join("; "),
          variant: "destructive",
        });
      }
      setInventoryItems((inv.data || []) as unknown as InventoryItem[]);
      setLaborRecords((lab.data || []) as unknown as LaborRecord[]);
      setLandCosts((land.data || []) as unknown as LandCost[]);
      setHarvestRecords((harv.data || []) as unknown as HarvestRecord[]);
      setHarvestLosses((loss.data || []) as unknown as HarvestLoss[]);
      setSalesRecords((sales.data || []) as unknown as SalesRecord[]);
    } catch (error) {
      if (version === requestVersion.current && userId === currentUserId.current) {
        clearRecords();
        toast({
          title: "Could not load farm inventory",
          description: error instanceof Error ? error.message : "Please retry.",
          variant: "destructive",
        });
      }
    } finally {
      if (version === requestVersion.current && userId === currentUserId.current) setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    void fetchAll();
    return () => { requestVersion.current += 1; };
  }, [fetchAll]);

  const resolveTable = (table: string): InventoryTable => {
    if (!INVENTORY_TABLES.includes(table as InventoryTable)) throw new Error("Unsupported inventory record type.");
    return table as InventoryTable;
  };

  const addRecord = async (tableName: string, data: Record<string, unknown>): Promise<boolean> => {
    const userId = user?.id;
    if (!userId || userId !== currentUserId.current) {
      toast({ title: "Sign in to save farm records", variant: "destructive" });
      return false;
    }
    try {
      const table = resolveTable(tableName);
      const payload = { ...normalizeInventoryRecord(table, data, true), user_id: userId };
      const { error } = await supabase.from(table as any).insert(payload as any);
      if (error) throw error;
      if (userId !== currentUserId.current) return false;
      toast({ title: "Added successfully" });
      await fetchAll();
      return true;
    } catch (error) {
      toast({
        title: "Error adding record",
        description: error instanceof Error ? error.message : "Please retry.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateRecord = async (tableName: string, id: string, data: Record<string, unknown>): Promise<boolean> => {
    const userId = user?.id;
    if (!userId || userId !== currentUserId.current || !id) {
      toast({ title: "Your session changed. Refresh and try again.", variant: "destructive" });
      return false;
    }
    try {
      const table = resolveTable(tableName);
      const payload = normalizeInventoryRecord(table, data, false);
      const { data: updated, error } = await supabase.from(table as any)
        .update(payload as any).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("Record not found or access denied.");
      if (userId !== currentUserId.current) return false;
      toast({ title: "Updated successfully" });
      await fetchAll();
      return true;
    } catch (error) {
      toast({
        title: "Error updating record",
        description: error instanceof Error ? error.message : "Please retry.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteRecord = async (tableName: string, id: string): Promise<boolean> => {
    const userId = user?.id;
    if (!userId || userId !== currentUserId.current || !id) {
      toast({ title: "Your session changed. Refresh and try again.", variant: "destructive" });
      return false;
    }
    try {
      const table = resolveTable(tableName);
      const { data: deleted, error } = await supabase.from(table as any)
        .delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!deleted) throw new Error("Record not found or access denied.");
      if (userId !== currentUserId.current) return false;
      toast({ title: "Deleted successfully" });
      await fetchAll();
      return true;
    } catch (error) {
      toast({
        title: "Error deleting record",
        description: error instanceof Error ? error.message : "Please retry.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Filter helper
  const applyFilter = <T extends { season?: string | null; crop_name?: string | null; farm_plot?: string | null }>(items: T[]) => {
    return items.filter((item) => {
      if (filterSeason && item.season !== filterSeason) return false;
      if (filterCrop && item.crop_name !== filterCrop) return false;
      if (filterPlot && item.farm_plot !== filterPlot) return false;
      return true;
    });
  };

  const filtered = {
    inventoryItems: applyFilter(inventoryItems),
    laborRecords: applyFilter(laborRecords),
    landCosts: filterSeason ? landCosts.filter(l => l.season === filterSeason) : landCosts,
    harvestRecords: applyFilter(harvestRecords),
    harvestLosses: applyFilter(harvestLosses),
    salesRecords: applyFilter(salesRecords),
  };

  // Metrics
  const metrics: InventoryMetrics = {
    totalInputsCost: filtered.inventoryItems.reduce((s, i) => s + i.quantity * i.price_per_unit, 0),
    totalLaborCost: filtered.laborRecords.reduce((s, l) => s + l.worker_count * l.days_worked * l.cost_per_day, 0),
    totalLandCost: filtered.landCosts.reduce((s, l) => s + l.cost_amount, 0),
    totalHarvestQty: filtered.harvestRecords.reduce((s, h) => s + h.quantity, 0),
    totalLosses: filtered.harvestLosses.reduce((s, l) => s + l.quantity_lost, 0),
    totalRevenue: filtered.salesRecords.reduce((s, sr) => s + sr.quantity_sold * sr.price_per_unit, 0),
    get netProfit() {
      return this.totalRevenue - this.totalInputsCost - this.totalLaborCost - this.totalLandCost;
    },
  };

  // CRUD helpers
const addRecord = async (table: string, data: any) => {
  if (!user) return;

  const payload = {
    ...data,
    user_id: user.id,
  };

  const { error } = await supabase
    .from(table as any)
    .insert(payload);

  if (error) {
    toast({
      title: "Error adding record",
      description: error.message,
      variant: "destructive",
    });
    return;
  }

  toast({ title: "Added successfully" });
  fetchAll();
};

const updateRecord = async (table: string, id: string, data: any) => {
  if (!user) return;

  const { error } = await supabase
    .from(table as any)
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    toast({
      title: "Error updating record",
      description: error.message,
      variant: "destructive",
    });
    return;
  }

  toast({ title: "Updated successfully" });
  fetchAll();
};

  const deleteRecord = async (table: string, id: string) => {
  if (!user || !id) return;

  const { error } = await supabase
    .from(table as any)
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    toast({
      title: "Error deleting record",
      description: error.message,
      variant: "destructive",
    });
    return;
  }

  toast({ title: "Deleted successfully" });
  fetchAll();
};

  // Get unique values for filters
  const seasons = [...new Set([
    ...inventoryItems.map(i => i.season),
    ...harvestRecords.map(h => h.season),
    ...salesRecords.map(s => s.season),
  ].filter(Boolean))] as string[];

  const crops = [...new Set([
    ...inventoryItems.map(i => i.crop_name),
    ...harvestRecords.map(h => h.crop_name),
    ...salesRecords.map(s => s.crop_name),
  ].filter(Boolean))] as string[];

  const plots = [...new Set([
    ...inventoryItems.map(i => i.farm_plot),
    ...harvestRecords.map(h => h.farm_plot),
  ].filter(Boolean))] as string[];

  return {
    ...filtered, metrics, loading, fetchAll,
    addRecord, updateRecord, deleteRecord,
    seasons, crops, plots,
  };
}
