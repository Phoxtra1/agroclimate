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
  cancelled_trips?: number;
  disputes: number;
  notes?: string;
}

const cleanText = (value?: string) => (value || "").trim();

const normalizeCorridors = (value?: string[] | null) =>
  Array.from(new Set((value || []).map((item) => cleanText(item)).filter(Boolean))).slice(0, 25);

const validateDriverPayload = (payload: Partial<DriverProfile>) => {
  const capacity = Number(payload.vehicle_capacity_kg || 0);
  const corridors = normalizeCorridors(payload.preferred_corridors || payload.route_coverage || []);
  const missing: string[] = [];

  if (!cleanText(payload.full_name)) missing.push("Full name");
  if (!cleanText(payload.phone)) missing.push("Phone number");
  if (!cleanText(payload.region)) missing.push("Operational region");
  if (!cleanText(payload.district)) missing.push("Base district");
  if (!cleanText(payload.vehicle_type)) missing.push("Vehicle type");
  if (!cleanText(payload.plate_number)) missing.push("License plate number");
  if (!cleanText(payload.license_class)) missing.push("Driver license class");
  if (!Number.isFinite(capacity) || capacity <= 0) missing.push("Vehicle capacity above 0 kg");
  if (corridors.length === 0) missing.push("At least one preferred transit corridor");

  const phone = cleanText(payload.phone);
  if (phone && !/^\+?[0-9\s().-]{7,20}$/.test(phone)) missing.push("A valid phone number");

  if (missing.length > 0) {
    throw new Error(`Driver onboarding incomplete: ${missing.join(", ")}.`);
  }

  return {
    full_name: cleanText(payload.full_name),
    phone,
    region: cleanText(payload.region),
    district: cleanText(payload.district),
    vehicle_type: cleanText(payload.vehicle_type),
    plate_number: cleanText(payload.plate_number).toUpperCase(),
    vehicle_capacity_kg: capacity,
    license_class: cleanText(payload.license_class).toUpperCase(),
    preferred_corridors: corridors,
    route_coverage: corridors,
  };
};

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

    const driverPayload = validateDriverPayload(payload);

    if (licenseFile) {
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowed.includes(licenseFile.type)) {
        throw new Error("Driver license must be a JPG, PNG, WebP, or PDF file.");
      }
      if (licenseFile.size > 10 * 1024 * 1024) {
        throw new Error("Driver license file must be 10MB or smaller.");
      }
    }

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
      .upsert({
        ...driverPayload,
        license_url,
        user_id: user.id,
        verification_status: "pending",
        availability_status: "offline",
        reliability_score: 100,
        completed_deliveries: 0,
        late_deliveries: 0,
        cancellations: 0,
        cancelled_trips: 0,
        disputes: 0,
      } as any, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    // Assign the driver role after the profile exists; ignore duplicate role rows.
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "driver" });
    if (roleError && roleError.code !== "23505") {
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
