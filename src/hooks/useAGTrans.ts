import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TransportRequest {
  id: string;
  supplier_id: string;
  buyer_id?: string;
  product_type: string;
  quantity: number;
  unit: string;
  pickup_location: string;
  delivery_location: string;
  status: string;
  estimated_price?: number;
  urgency: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  preferred_pickup_at?: string;
  driver_id?: string;
  tracking_code: string;
  pickup_lat?: number;
  pickup_lon?: number;
  delivery_lat?: number;
  delivery_lon?: number;
}

export interface DriverProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  plate_number: string;
  license_class: string;
  region?: string;
  district?: string;
  vehicle_capacity_kg?: number;
  route_coverage?: string[];
  preferred_corridors?: string[];
  license_url?: string;
  availability_status: "online" | "offline";
  verification_status: "pending" | "verified" | "suspended" | "rejected";
  reliability_score: number;
  completed_deliveries: number;
  late_deliveries: number;
  cancellations: number;
  disputes: number;
  notes?: string;
}

export function useAGTrans() {
  const { user, refreshSession } = useAuth();
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      const { data: dp } = await supabase
        .from("agtrans_drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dp) setDriverProfile(dp as unknown as DriverProfile);

      const { data: reqs } = await supabase
        .from("agtrans_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setRequests((reqs as unknown as TransportRequest[]) || []);
      setLoading(false);
    };

    loadData();

    const ch = supabase.channel("agtrans-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_requests" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const createRequest = async (payload: Partial<TransportRequest>) => {
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("agtrans_requests")
      .insert({
        ...payload,
        supplier_id: user.id,
        status: "searching_driver",
      } as any)
      .select()
      .single();

    if (error) throw error;

    supabase.functions.invoke("agtrans-broadcast", { body: { request_id: data.id } }).catch(console.error);

    return data;
  };

  const updateRequestStatus = async (id: string, status: string, driver_id?: string) => {
    const updates: any = { status };
    if (driver_id) updates.driver_id = driver_id;

    const { error } = await supabase
      .from("agtrans_requests")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    if (status === "in_transit") {
      supabase.functions.invoke("agtrans-ai-advisor", { body: { request_id: id, action: "optimize_route" } }).catch(console.error);
    }
  };

  const createDriverProfile = async (payload: Partial<DriverProfile>, licenseFile?: File) => {
    if (!user) throw new Error("Not authenticated");

    let license_url = undefined;
    if (licenseFile) {
      const fileExt = licenseFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("agtrans-licenses")
        .upload(filePath, licenseFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("agtrans-licenses")
        .getPublicUrl(filePath);

      license_url = urlData.publicUrl;
    }

    const { data, error } = await supabase
      .from("agtrans_drivers")
      .insert({
        ...payload,
        license_url,
        user_id: user.id,
        verification_status: "pending",
        availability_status: "offline",
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Upsert the driver role into user_roles table
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "driver" }, { onConflict: "user_id,role" });
    if (roleError) {
      console.error("Error setting driver role in user_roles:", roleError);
    }
    
    // Auto-update user metadata to include driver role
    await supabase.auth.updateUser({
      data: { role: "driver" }
    });

    // Sync auth context session immediately to propagate changes
    await refreshSession();

    setDriverProfile(data as unknown as DriverProfile);
    return data;
  };

  const toggleAvailability = async (status: "online" | "offline") => {
    if (!user) return;
    const { error } = await supabase
      .from("agtrans_drivers")
      .update({ availability_status: status })
      .eq("user_id", user.id);
    if (!error && driverProfile) {
      setDriverProfile({ ...driverProfile, availability_status: status });
    }
  };

  const confirmDelivery = async (id: string) => {
    const { error } = await supabase
      .from("agtrans_requests")
      .update({ status: "delivery_confirmed" })
      .eq("id", id);

    if (error) throw error;
  };

  return {
    requests,
    loading,
    driverProfile,
    createRequest,
    updateRequestStatus,
    createDriverProfile,
    toggleAvailability,
    confirmDelivery,
  };
}
