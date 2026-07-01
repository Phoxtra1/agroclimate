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
  // Expanded fields
  insurance_status?: string;
  roadworthiness_status?: string;
  cargo_categories?: string[];
  rate_information?: string;
  vehicle_images?: string[];
  current_location?: { lat: number; lon: number };
}

export interface DeliveryJob {
  id: string;
  supplier_id: string;
  driver_id: string;
  product: string;
  quantity: number;
  pickup_location: string;
  destination: string;
  status: 'Pending' | 'Accepted' | 'Loading' | 'In Transit' | 'Near Destination' | 'Delivered' | 'Cancelled';
  created_at: string;
  updated_at: string;
}

export interface TrackingSession {
  id: string;
  delivery_job_id: string;
  driver_id: string;
  driver_name: string;
  vehicle_type: string;
  plate_number: string;
  pickup_location: string;
  destination: string;
  route?: any;
  eta?: string;
  distance_m?: number;
  current_lat?: number;
  current_lon?: number;
  speed_kn?: number;
  heading?: number;
  status: string;
  created_at: string;
  updated_at: string;
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
  const [deliveryJobs, setDeliveryJobs] = useState<DeliveryJob[]>([]);
  const [trackingSessions, setTrackingSessions] = useState<TrackingSession[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch current user's driver profile
      const { data: dp } = await supabase
        .from("agtrans_drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dp) setDriverProfile(dp as unknown as DriverProfile);

      // Fetch all requests
      const { data: reqs } = await supabase
        .from("agtrans_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setRequests((reqs as unknown as TransportRequest[]) || []);

      // Fetch all verified drivers
      const { data: drvs } = await supabase
        .from("agtrans_drivers")
        .select("*");
      setDrivers((drvs as unknown as DriverProfile[]) || []);

      // Fetch delivery jobs
      const { data: jobs } = await supabase
        .from("delivery_jobs" as any)
        .select("*")
        .order("created_at", { ascending: false });
      setDeliveryJobs((jobs as unknown as DeliveryJob[]) || []);

      // Fetch tracking sessions
      const { data: tracks } = await supabase
        .from("tracking_sessions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      setTrackingSessions((tracks as unknown as TrackingSession[]) || []);

    } catch (err) {
      console.error("Error loading AGTrans data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const ch = supabase.channel("agtrans-realtime-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_requests" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" as any }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_sessions" as any }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const createRequest = async (payload: Partial<TransportRequest>) => {
    if (!user) throw new Error("Not authenticated");

    const tracking_code = "AGT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("agtrans_requests")
      .insert({
        ...payload,
        supplier_id: user.id,
        status: payload.driver_id ? "Pending" : "searching_driver",
        tracking_code,
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

  const updateDriverProfile = async (payload: Partial<DriverProfile>) => {
    if (!user || !driverProfile) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("agtrans_drivers")
      .update(payload as any)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    setDriverProfile(data as unknown as DriverProfile);
    return data;
  };

  const toggleAvailability = async (status: "online" | "offline") => {
    if (!user) return;
    await updateDriverProfile({ availability_status: status });
  };

  const createDeliveryJob = async (request: TransportRequest) => {
    if (!user) throw new Error("Not authenticated");
    
    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("delivery_jobs" as any)
      .insert({
        supplier_id: request.supplier_id,
        driver_id: user.id,
        product: request.product_type,
        quantity: request.quantity,
        pickup_location: request.pickup_location,
        destination: request.delivery_location,
        status: "Accepted",
      } as any)
      .select()
      .single();

    if (jobError) throw jobError;

    // Also update request status
    await updateRequestStatus(request.id, "Accepted", user.id);

    // Create tracking session immediately in AGNav
    const { error: trackError } = await supabase
      .from("tracking_sessions" as any)
      .insert({
        delivery_job_id: (job as any).id,
        driver_id: user.id,
        driver_name: driverProfile?.full_name || "Verified Driver",
        vehicle_type: driverProfile?.vehicle_type || "Truck",
        plate_number: driverProfile?.plate_number || "",
        pickup_location: request.pickup_location,
        destination: request.delivery_location,
        status: "active",
        current_lat: request.pickup_lat || 5.6037, // default Accra
        current_lon: request.pickup_lon || -0.1870,
        speed_kn: 0,
        heading: 0,
        eta: "Calculating...",
        distance_m: 0,
      } as any);

    if (trackError) {
      console.error("Error creating tracking session:", trackError);
    }

    return job;
  };

  const updateDeliveryJobStatus = async (jobId: string, status: DeliveryJob['status']) => {
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("delivery_jobs" as any)
      .update({ status })
      .eq("id", jobId);

    if (error) throw error;

    // If delivered, we increment completed deliveries and reward driver's reliability score
    if (status === "Delivered" && driverProfile) {
      const completed = (driverProfile.completed_deliveries || 0) + 1;
      const currentScore = driverProfile.reliability_score || 100;
      const nextScore = Math.min(100, currentScore + 2); // boost reliability for success
      await updateDriverProfile({
        completed_deliveries: completed,
        reliability_score: nextScore,
      });
    }

    // Also update tracking status
    if (status === "Delivered" || status === "Cancelled") {
      await supabase
        .from("tracking_sessions" as any)
        .update({ status: status === "Delivered" ? "completed" : "cancelled" })
        .eq("delivery_job_id", jobId);
    }
  };

  const updateTrackingSessionLocation = async (jobId: string, locationData: { lat: number; lon: number; speed_kn?: number; heading?: number; eta?: string; distance_m?: number; route?: any }) => {
    const { error } = await supabase
      .from("tracking_sessions" as any)
      .update({
        current_lat: locationData.lat,
        current_lon: locationData.lon,
        speed_kn: locationData.speed_kn || 0,
        heading: locationData.heading || 0,
        eta: locationData.eta,
        distance_m: locationData.distance_m,
        route: locationData.route,
      } as any)
      .eq("delivery_job_id", jobId);

    if (error) {
      console.error("Error updating live location:", error);
    }
  };

  const handleCancelTrip = async (jobId: string) => {
    if (!user || !driverProfile) throw new Error("Not authenticated");

    // Implement fine and suspension rules
    const cancellations = (driverProfile.cancellations || 0) + 1;
    const currentScore = driverProfile.reliability_score || 100;
    const nextScore = Math.max(0, currentScore - 15); // severe penalty for cancellation
    const isSuspended = cancellations >= 3;

    const profileUpdates: Partial<DriverProfile> = {
      cancellations,
      reliability_score: nextScore,
      verification_status: isSuspended ? "suspended" : driverProfile.verification_status,
      notes: isSuspended 
        ? "Suspended automatically for 30 days due to high cancellation count." 
        : driverProfile.notes,
    };

    await updateDriverProfile(profileUpdates);
    await updateDeliveryJobStatus(jobId, "Cancelled");
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
    deliveryJobs,
    trackingSessions,
    drivers,
    loading,
    driverProfile,
    createRequest,
    updateRequestStatus,
    createDriverProfile,
    updateDriverProfile,
    toggleAvailability,
    confirmDelivery,
    createDeliveryJob,
    updateDeliveryJobStatus,
    updateTrackingSessionLocation,
    handleCancelTrip,
    reload: loadData,
  };
}
