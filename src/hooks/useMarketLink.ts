import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FarmerInput {
  id: string;
  user_id: string;
  crop_name: string;
  region: string | null;
  expected_quantity: number;
  unit: string;
  harvest_start: string | null;
  harvest_end: string | null;
  risk_level: "low" | "medium" | "high";
  status: "open" | "committed" | "fulfilled" | "cancelled";
  notes: string | null;
  category?: string | null;
  image_url?: string | null;
  quality_grade?: string | null;
  suggested_price?: number | null;
  price_label?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuyerOrder {
  id: string;
  buyer_id: string;
  buyer_name: string | null;
  crop_name: string;
  region: string | null;
  quantity_needed: number;
  unit: string;
  target_price: number;
  price_label?: string | null;
  delivery_start: string | null;
  delivery_end: string | null;
  status: "open" | "matched" | "fulfilled" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketContract {
  id: string;
  farmer_id: string;
  buyer_id: string;
  farmer_input_id: string | null;
  buyer_order_id: string | null;
  crop_name: string;
  quantity: number;
  unit: string;
  locked_price: number;
  delivery_start: string | null;
  delivery_end: string | null;
  state: "proposed" | "accepted" | "rejected" | "cancelled" | "completed";
  logistics_status: "pending" | "scheduled" | "in_transit" | "delivered";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceRow {
  id: string;
  crop_name: string;
  region: string | null;
  current_price: number;
  suggested_price: number;
  trend: "rising" | "falling" | "stable";
  unit: string;
}

export function useMarketLink() {
  const { user } = useAuth();
  const [supply, setSupply] = useState<FarmerInput[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [contracts, setContracts] = useState<MarketContract[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o, c, p] = await Promise.all([
        supabase.from("farmer_inputs" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("buyer_orders" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("market_contracts" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("price_intelligence" as any).select("*").order("crop_name", { ascending: true }),
      ]);
      setSupply((s.data as any) || []);
      setOrders((o.data as any) || []);
      setContracts((c.data as any) || []);
      setPrices((p.data as any) || []);
    } catch (err) {
      console.error("[MarketLink] fetchAll failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("market-link-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "farmer_inputs" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_contracts" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "price_intelligence" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ---- Farmer input ops ----
  const addSupply = async (input: Omit<FarmerInput, "id" | "user_id" | "created_at" | "updated_at" | "status" | "risk_level"> & { risk_level?: FarmerInput["risk_level"] }) => {
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase.from("farmer_inputs" as any).insert({
      ...input,
      user_id: user.id,
      risk_level: input.risk_level || "low",
    } as any);
    if (error) throw error;
  };
  const updateSupply = async (id: string, patch: Partial<FarmerInput>) => {
    const { error } = await supabase.from("farmer_inputs" as any).update(patch as any).eq("id", id);
    if (error) throw error;
  };
  const deleteSupply = async (id: string) => {
    const { error } = await supabase.from("farmer_inputs" as any).delete().eq("id", id);
    if (error) throw error;
  };

  // ---- Buyer order ops ----
  const addOrder = async (input: Omit<BuyerOrder, "id" | "buyer_id" | "created_at" | "updated_at" | "status">) => {
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase.from("buyer_orders" as any).insert({
      ...input,
      buyer_id: user.id,
    } as any);
    if (error) throw error;
  };
  const updateOrder = async (id: string, patch: Partial<BuyerOrder>) => {
    const { error } = await supabase.from("buyer_orders" as any).update(patch as any).eq("id", id);
    if (error) throw error;
  };
  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from("buyer_orders" as any).delete().eq("id", id);
    if (error) throw error;
  };

  // ---- Contract ops ----
  // A buyer proposes a contract against a farmer's supply listing.
  const proposeContract = async (params: {
    farmer_id: string;
    farmer_input_id?: string;
    buyer_order_id?: string;
    crop_name: string;
    quantity: number;
    unit: string;
    locked_price: number;
    delivery_start?: string | null;
    delivery_end?: string | null;
    notes?: string | null;
  }) => {
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase.from("market_contracts" as any).insert({
      farmer_id: params.farmer_id,
      buyer_id: user.id,
      farmer_input_id: params.farmer_input_id || null,
      buyer_order_id: params.buyer_order_id || null,
      crop_name: params.crop_name,
      quantity: params.quantity,
      unit: params.unit,
      locked_price: params.locked_price,
      delivery_start: params.delivery_start || null,
      delivery_end: params.delivery_end || null,
      notes: params.notes || null,
      state: "proposed",
      logistics_status: "pending",
    } as any);
    if (error) throw error;
  };
  const setContractState = async (id: string, state: MarketContract["state"]) => {
    const { error } = await supabase.from("market_contracts" as any).update({ state } as any).eq("id", id);
    if (error) throw error;
  };
  const setLogistics = async (id: string, logistics_status: MarketContract["logistics_status"]) => {
    const { error } = await supabase.from("market_contracts" as any).update({ logistics_status } as any).eq("id", id);
    if (error) throw error;
  };

  // ---- Derived insights ----
  const totalSupply = supply
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + Number(s.expected_quantity || 0), 0);
  const totalDemand = orders
    .filter((o) => o.status === "open" || o.status === "matched")
    .reduce((sum, o) => sum + Number(o.quantity_needed || 0), 0);
  const activeContracts = contracts.filter((c) => c.state === "accepted" || c.state === "proposed").length;
  const balance: "surplus" | "shortage" | "balanced" =
    totalSupply > totalDemand * 1.1 ? "surplus" : totalDemand > totalSupply * 1.1 ? "shortage" : "balanced";

  return {
    user,
    loading,
    supply, orders, contracts, prices,
    totalSupply, totalDemand, activeContracts, balance,
    addSupply, updateSupply, deleteSupply,
    addOrder, updateOrder, deleteOrder,
    proposeContract, setContractState, setLogistics,
    refresh: fetchAll,
  };
}

// Suggested price: simple rule - demand/supply ratio + risk uplift
export function suggestPrice(currentAvg: number, supplyQty: number, demandQty: number, riskBoost = 0): number {
  if (!currentAvg) return 0;
  const ratio = supplyQty <= 0 ? 1.5 : Math.min(2, Math.max(0.6, demandQty / supplyQty));
  return Math.round(currentAvg * ratio * (1 + riskBoost) * 100) / 100;
}
