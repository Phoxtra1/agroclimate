import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface TransportRequest {
  id: string;
  supplier_id: string;
  cargo_type: string;
  quantity: number;
  unit: string;
  pickup_location: string;
  dropoff_location: string;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "disputed";
  price_offer: number;
  created_at: string;
  notes: string;
  driver_id?: string;
  tracking_id?: string;
}

export interface DriverProfile {
  user_id: string;
  vehicle_type: string;
  license_number: string;
  verification_status: "pending" | "verified" | "rejected";
  rating: number;
  total_trips: number;
}

export function useAGTrans() {
  const { user } = useAuth();
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
      // Fetch driver profile if it exists
      const { data: dp } = await supabase
        .from("agtrans_drivers" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (dp) setDriverProfile(dp as DriverProfile);

      // Fetch requests
      // If driver, show available or their own. If supplier, show their own.
      // We just fetch all for now or filter by relevance
      const { data: reqs } = await supabase
        .from("transport_requests" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      setRequests((reqs as TransportRequest[]) || []);
      setLoading(false);
    };

    loadData();

    // Subscribe to changes
    const ch = supabase.channel("agtrans-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_requests" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const createRequest = async (payload: Partial<TransportRequest>) => {
    if (!user) throw new Error("Not authenticated");
    
    // Auto-generate tracking ID
    const tracking_id = "TRK-" + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data, error } = await supabase
      .from("transport_requests" as any)
      .insert({
        ...payload,
        supplier_id: user.id,
        status: "pending",
        tracking_id
      })
      .select()
      .single();

    if (error) throw error;
    
    // Broadcast via edge function
    supabase.functions.invoke("agtrans-broadcast", { body: { request_id: data.id } }).catch(console.error);

    return data;
  };

  const updateRequestStatus = async (id: string, status: TransportRequest["status"], driver_id?: string) => {
    const updates: any = { status };
    if (driver_id) updates.driver_id = driver_id;

    const { error } = await supabase
      .from("transport_requests" as any)
      .update(updates)
      .eq("id", id);
    
    if (error) throw error;
    
    if (status === "in_transit") {
      // Trigger AI route calculation when transit starts
      supabase.functions.invoke("agtrans-ai-advisor", { body: { request_id: id, action: "optimize_route" } }).catch(console.error);
    }
  };

  const updateDriverLocation = async (id: string, lat: number, lng: number) => {
    const { error } = await supabase
      .from("transport_requests" as any)
      .update({ current_lat: lat, current_lng: lng })
      .eq("id", id);
      
    if (error) throw error;
    
    // Trigger AI consistency & tracking check
    supabase.functions.invoke("agtrans-ai-advisor", { body: { request_id: id, action: "track_location", lat, lng } }).catch(console.error);
  };

  const createDriverProfile = async (payload: Partial<DriverProfile>) => {
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("agtrans_drivers" as any)
      .insert({
        ...payload,
        user_id: user.id,
        verification_status: "pending"
      })
      .select()
      .single();
    
    if (error) throw error;
    setDriverProfile(data as DriverProfile);
    return data;
  };

  return {
    requests,
    loading,
    driverProfile,
    createRequest,
    updateRequestStatus,
    updateDriverLocation,
    createDriverProfile
  };
}
