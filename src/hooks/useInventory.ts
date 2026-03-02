import { useState, useEffect, useCallback } from "react";
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

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [inv, lab, land, harv, loss, sales] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("labor_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("land_costs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("harvest_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("harvest_losses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("sales_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setInventoryItems((inv.data || []) as any);
      setLaborRecords((lab.data || []) as any);
      setLandCosts((land.data || []) as any);
      setHarvestRecords((harv.data || []) as any);
      setHarvestLosses((loss.data || []) as any);
      setSalesRecords((sales.data || []) as any);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
