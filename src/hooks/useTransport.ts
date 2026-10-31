import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* Many Supabase dynamic queries need runtime casts; disable the explicit-any rule for this file. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "more_info";

export type AvailabilityStatus =
  | "online"
  | "busy"
  | "offline"
  | "full_capacity";

export type OfferStatus = "published" | "paused" | "removed" | "completed";

export type RouteFlexibility =
  | "Strict Route Only"
  | "Minor Detour Allowed"
  | "Accept Off-Route Requests";

export type PricingType = "Negotiable" | "Fixed Price";

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
  availability_status: AvailabilityStatus;
  verification_status: string;
  approval_status: ApprovalStatus;
  rejection_reason?: string;
  admin_suspended: boolean;
  reliability_score: number;
  completed_deliveries: number;
  late_deliveries: number;
  cancellations: number;
  cancelled_trips?: number;
  disputes: number;
  notes?: string;
  insurance_status?: string;
  roadworthiness_status?: string;
  cargo_categories?: string[];
  rate_information?: string;
  vehicle_images?: string[];
  current_location?: { lat: number; lon: number };
  // Transport offer fields
  driver_photo_url?: string;
  driver_rating: number;
  rating_count: number;
  vehicle_features: string[];
  cargo_types_accepted: string[];
  current_location_text?: string;
  pickup_area?: string;
  destination?: string;
  planned_route?: string;
  departure_date?: string;
  departure_time?: string;
  estimated_arrival?: string;
  route_flexibility?: RouteFlexibility;
  pricing_type: PricingType;
  suggested_fee?: number;
  offer_notes?: string;
  special_cargo_instructions?: string;
  offer_status: OfferStatus;
  created_at?: string;
  updated_at?: string;
  remaining_capacity: number;
}

export interface TransportRequest {
  id: string;
  supplier_id: string;
  buyer_id?: string;
  agreement_id?: string;
  marketplace_order_id?: string;
  transport_offer_id?: string;
  request_type?: string;
  product_type: string;
  quantity: number;
  unit: string;
  cargo_weight?: number;
  cargo_types?: string[];
  cargo_features?: string[];
  pickup_location: string;
  delivery_location: string;
  status: string;
  estimated_price?: number;
  supplier_offer_price?: number;
  driver_counter_price?: number;
  agreed_fee?: number;
  agreement_timestamp?: string;
  negotiation_status?: string;
  rejection_reason?: string;
  counter_note?: string;
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

export interface DeliveryJob {
  id: string;
  supplier_id: string;
  buyer_id?: string;
  driver_id: string;
  request_id?: string;
  agreement_id?: string;
  transport_agreement_id?: string;
  transport_fee?: number;
  product: string;
  quantity: number;
  pickup_location: string;
  destination: string;
  driver_name?: string;
  vehicle_type?: string;
  plate_number?: string;
  status:
    | "Assigned"
    | "Driver En Route"
    | "Loading"
    | "Picked Up"
    | "In Transit"
    | "Near Delivery"
    | "Delivered"
    | "Completed"
    | "Cancelled";
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
  current_lat?: number | null;
  current_lon?: number | null;
  speed_kn?: number | null;
  heading?: number | null;
  last_location_at?: string | null;
  location_accuracy_m?: number | null;
  location_source?: "unverified" | "device_gps" | "simulated";
  is_simulated?: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TransportAgreement {
  id: string;
  request_id?: string;
  supplier_id: string;
  buyer_id?: string;
  driver_id: string;
  marketplace_order_id?: string;
  agreed_fee: number;
  agreement_timestamp: string;
  delivery_status: string;
  created_at: string;
  updated_at: string;
}

export interface DriverHistory {
  completed: DeliveryJob[];
  active: DeliveryJob[];
  cancelled: DeliveryJob[];
  ratings: { request_id: string; score: number; comment?: string; created_at: string }[];
}

const cleanText = (value?: string) => (value || "").trim();

const normalizeArray = (value?: string | string[]) => {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

export function useAGTrans() {
  const { user, refreshSession } = useAuth();
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [deliveryJobs, setDeliveryJobs] = useState<DeliveryJob[]>([]);
  const [trackingSessions, setTrackingSessions] = useState<TrackingSession[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [history, setHistory] = useState<DriverHistory | null>(null);

  const seenRequestsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const safeSelect = async <T,>(table: string, opts?: { order?: boolean; limit?: number }) => {
    try {
      let q: any = supabase.from(table as any).select("*");
      if (opts?.order) q = q.order("created_at", { ascending: false });
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) {
        console.warn(`[AGTrans] ${table} read skipped:`, error.message);
        return [] as T[];
      }
      return (data as unknown as T[]) || [];
    } catch (err) {
      console.warn(`[AGTrans] ${table} threw:`, err);
      return [] as T[];
    }
  };

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: dp } = await supabase
        .from("agtrans_drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (dp) setDriverProfile(dp as unknown as DriverProfile);

      const reqs = await safeSelect<TransportRequest>("agtrans_requests", { order: true, limit: 100 });
      setRequests(reqs);

      if (!initialLoadRef.current) {
        for (const r of reqs) {
          if (!seenRequestsRef.current.has(r.id) && r.status === "searching_driver") {
            toast.info(`New transport request · ${r.product_type}`, {
              description: `${r.pickup_location} → ${r.delivery_location} · ${r.quantity} ${r.unit}`,
            });
          }
        }
      }
      seenRequestsRef.current = new Set(reqs.map((r) => r.id));
      initialLoadRef.current = false;

      const drvs = await safeSelect<DriverProfile>("agtrans_drivers");
      setDrivers(drvs);

      const jobs = await safeSelect<DeliveryJob>("delivery_jobs", { order: true });
      setDeliveryJobs(jobs);

      const tracks = await safeSelect<TrackingSession>("tracking_sessions", { order: true });
      setTrackingSessions(tracks);
    } catch (err) {
      console.error("Error loading AGTrans data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();

    // Use a unique channel name per mount to avoid silent subscription conflicts
    // when the user switches tabs and comes back (Supabase rejects duplicate channel names)
    const channelId = `agtrans-rt-${Math.random().toString(36).slice(2, 9)}`;
    const ch = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_requests" }, (payload: any) => {
        if (payload?.eventType === "INSERT" && payload?.new) {
          const r = payload.new;
          if (r.status === "searching_driver" && !seenRequestsRef.current.has(r.id)) {
            seenRequestsRef.current.add(r.id);
            toast.info(`🚚 New transport request · ${r.product_type}`, {
              description: `${r.pickup_location} → ${r.delivery_location}`,
            });
          }
        }
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agtrans_drivers" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_sessions" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_agreements" }, loadData)
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [user, loadData]);

  const notifyUser = async (userId: string, type: string, title: string, message: string, data?: any) => {
    try {
      await supabase.from("transport_notifications" as any).insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
      } as any);
    } catch (e) {
      console.warn("Failed to persist notification:", e);
    }
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body: message, icon: "/placeholder.svg" });
      }
    } catch { /* notification best-effort */ }
    toast.info(title, { description: message });
  };

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

  const validateDriverPayload = (payload: Partial<DriverProfile>) => {
    const capacity = Number(payload.vehicle_capacity_kg || 0);
    const corridors = normalizeArray(payload.preferred_corridors || payload.route_coverage);
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

      // The bucket is private: store the object path, admins open it through a
      // signed URL. A public URL would always 404.
      license_url = filePath;

    }

    const { data, error } = await supabase
      .from("agtrans_drivers")
      .upsert({
        ...driverPayload,
        license_url,
        user_id: user.id,
        verification_status: "pending",
        approval_status: "pending",
        offer_status: "paused",
        availability_status: "offline",
        admin_suspended: false,
        reliability_score: 100,
        completed_deliveries: 0,
        late_deliveries: 0,
        cancellations: 0,
        disputes: 0,
        driver_rating: 0,
        rating_count: 0,
        vehicle_features: [],
        cargo_types_accepted: [],
        remaining_capacity: 0,
      } as any, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "driver" });
    if (roleError && roleError.code !== "23505") {
      console.error("Error setting driver role in user_roles:", roleError);
    }

    await supabase.auth.updateUser({
      data: { role: "driver" },
    });

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

  const toggleAvailability = async (status: AvailabilityStatus) => {
    if (!user) return;
    await updateDriverProfile({ availability_status: status });
  };

  // ---------- Transport Offer management ----------

  const offerPayload = (values: Partial<DriverProfile>) => {
    const capacity = Number(values.vehicle_capacity_kg || driverProfile?.vehicle_capacity_kg || 0);
    return {
      driver_photo_url: cleanText(values.driver_photo_url) || driverProfile?.driver_photo_url,
      driver_rating: driverProfile?.driver_rating ?? 0,
      rating_count: driverProfile?.rating_count ?? 0,
      vehicle_features: normalizeArray(values.vehicle_features),
      cargo_types_accepted: normalizeArray(values.cargo_types_accepted),
      current_location_text: cleanText(values.current_location_text),
      pickup_area: cleanText(values.pickup_area),
      destination: cleanText(values.destination),
      planned_route: cleanText(values.planned_route),
      departure_date: values.departure_date,
      departure_time: cleanText(values.departure_time),
      estimated_arrival: cleanText(values.estimated_arrival),
      route_flexibility: values.route_flexibility,
      pricing_type: values.pricing_type || (driverProfile?.pricing_type ?? "Negotiable"),
      suggested_fee: values.suggested_fee !== undefined ? Number(values.suggested_fee) : driverProfile?.suggested_fee,
      offer_notes: cleanText(values.offer_notes),
      special_cargo_instructions: cleanText(values.special_cargo_instructions),
      remaining_capacity: values.remaining_capacity !== undefined ? Number(values.remaining_capacity) : capacity,
      offer_status: (values.offer_status || "published") as OfferStatus,
      availability_status: "online" as AvailabilityStatus,
    };
  };

  const publishOffer = async (values: Partial<DriverProfile>) => {
    if (!user || !driverProfile) throw new Error("Not authenticated");
    if (driverProfile.approval_status !== "approved" || driverProfile.admin_suspended) {
      throw new Error("Your driver account must be approved to publish a transport offer.");
    }
    const payload = offerPayload(values);
    const { data, error } = await supabase
      .from("agtrans_drivers")
      .update({ ...payload, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setDriverProfile(data as unknown as DriverProfile);
    return data;
  };

  const updateOffer = publishOffer;

  const pauseOffer = async () => {
    if (!user || !driverProfile) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("agtrans_drivers")
      .update({ offer_status: "paused", updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setDriverProfile(data as unknown as DriverProfile);
    return data;
  };

  const removeOffer = async () => {
    if (!user || !driverProfile) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("agtrans_drivers")
      .update({ offer_status: "removed", availability_status: "offline", updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setDriverProfile(data as unknown as DriverProfile);
    return data;
  };

  const publishableOffers = useCallback(() => {
    return drivers.filter(
      (d) =>
        d.approval_status === "approved" &&
        !d.admin_suspended &&
        d.offer_status === "published" &&
        d.availability_status === "online" &&
        d.remaining_capacity > 0
    );
  }, [drivers]);

  // ---------- Supplier request / negotiation ----------

  const sendTransportRequest = async (params: {
    offer: DriverProfile;
    order: { id?: string; product?: string; quantity?: number; unit?: string; pickup?: string; delivery?: string; buyer_id?: string; cargo_types?: string[]; cargo_features?: string[]; cargo_weight?: number };
    supplier_offer_price?: number;
    notes?: string;
  }) => {
    if (!user) throw new Error("Not authenticated");
    const { offer, order } = params;

    const tracking_code = "AGT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("agtrans_requests")
      .insert({
        supplier_id: user.id,
        driver_id: offer.user_id,
        transport_offer_id: offer.id,
        marketplace_order_id: order.id,
        request_type: "offer_request",
        product_type: order.product || "General Goods",
        quantity: order.quantity || 0,
        unit: order.unit || "kg",
        cargo_weight: order.cargo_weight,
        cargo_types: order.cargo_types || [],
        cargo_features: order.cargo_features || [],
        pickup_location: order.pickup || offer.current_location_text || "",
        delivery_location: order.delivery || offer.destination || "",
        status: "pending",
        negotiation_status: "pending",
        supplier_offer_price: params.supplier_offer_price,
        notes: params.notes,
        tracking_code,
        buyer_id: order.buyer_id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    await notifyUser(
      offer.user_id,
      "new_transport_request",
      "New Transport Request",
      `${order.product || "Cargo"} · ${order.quantity || 0} ${order.unit || "kg"} from ${order.pickup || "?"} to ${order.delivery || "?"}`,
      { request_id: data.id, supplier_id: user.id }
    );

    return data;
  };

  const respondToRequest = async (requestId: string, action: "accept" | "decline" | "counter", payload?: { counter_price?: number; counter_note?: string }) => {
    if (!user || !driverProfile) throw new Error("Not authenticated");

    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error("Request not found");

    if (action === "decline") {
      const { error } = await supabase
        .from("agtrans_requests")
        .update({
          status: "declined",
          negotiation_status: "declined",
          rejection_reason: payload?.counter_note || "Driver declined",
        } as any)
        .eq("id", requestId);
      if (error) throw error;
      await notifyUser(request.supplier_id, "driver_declined", "Driver Declined", `Driver declined transport request ${request.tracking_code}`);
      return;
    }

    if (action === "counter") {
      const { error } = await supabase
        .from("agtrans_requests")
        .update({
          negotiation_status: "counter",
          driver_counter_price: payload?.counter_price,
          counter_note: payload?.counter_note,
        } as any)
        .eq("id", requestId);
      if (error) throw error;
      await notifyUser(request.supplier_id, "counter_offer", "Counter Offer Received", `Driver countered with ${payload?.counter_price} GHS`);
      return;
    }

    // accept
    const agreedFee = request.agreed_fee ?? request.supplier_offer_price ?? 0;
    await supabase
      .from("agtrans_requests")
      .update({
        status: "accepted",
        negotiation_status: "accepted",
        agreed_fee: agreedFee,
        agreement_timestamp: new Date().toISOString(),
        driver_id: user.id,
      } as any)
      .eq("id", requestId);

    await createDeliveryJob(request, agreedFee);

    await notifyUser(request.supplier_id, "driver_accepted", "Driver Accepted", `Driver accepted transport request ${request.tracking_code}`);
    if (request.buyer_id) {
      await notifyUser(request.buyer_id, "transport_agreement_created", "Transport Agreement Created", `Your order is being shipped by ${driverProfile.full_name}`);
    }
  };

  const respondToCounter = async (requestId: string, action: "accept" | "counter", payload?: { supplier_offer_price?: number; counter_note?: string }) => {
    if (!user) throw new Error("Not authenticated");

    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error("Request not found");

    if (action === "counter") {
      const { error } = await supabase
        .from("agtrans_requests")
        .update({
          negotiation_status: "counter_supplier",
          supplier_offer_price: payload?.supplier_offer_price,
          counter_note: payload?.counter_note,
        } as any)
        .eq("id", requestId);
      if (error) throw error;
      await notifyUser(request.driver_id || "", "counter_offer", "Counter Offer Received", `Supplier countered with ${payload?.supplier_offer_price} GHS`);
      return;
    }

    const agreedFee = request.driver_counter_price ?? request.supplier_offer_price ?? 0;
    await supabase
      .from("agtrans_requests")
      .update({
        status: "accepted",
        negotiation_status: "accepted",
        agreed_fee: agreedFee,
        agreement_timestamp: new Date().toISOString(),
      } as any)
      .eq("id", requestId);

    await createDeliveryJob(request, agreedFee);

    await notifyUser(request.driver_id || "", "supplier_accepted", "Supplier Accepted", `Supplier accepted your counter offer for ${request.tracking_code}`);
    if (request.buyer_id) {
      await notifyUser(request.buyer_id, "transport_agreement_created", "Transport Agreement Created", `Your order is being shipped`);
    }
  };

  const createDeliveryJob = async (request: TransportRequest, transportFee?: number) => {
    if (!user) throw new Error("Not authenticated");

    const driver = drivers.find((d) => d.user_id === request.driver_id) || driverProfile;
    if (!driver) throw new Error("Driver not found");

    const { data: job, error: jobError } = await supabase
      .from("delivery_jobs")
      .insert({
        supplier_id: request.supplier_id,
        buyer_id: request.buyer_id,
        driver_id: request.driver_id,
        request_id: request.id,
        agreement_id: request.agreement_id,
        product: request.product_type,
        quantity: request.quantity,
        pickup_location: request.pickup_location,
        destination: request.delivery_location,
        transport_fee: transportFee,
        driver_name: driver.full_name,
        vehicle_type: driver.vehicle_type,
        plate_number: driver.plate_number,
        status: "Assigned",
      } as any)
      .select()
      .single();

    if (jobError) throw jobError;

    const { data: ta, error: taError } = await supabase
      .from("transport_agreements")
      .insert({
        request_id: request.id,
        supplier_id: request.supplier_id,
        buyer_id: request.buyer_id,
        driver_id: request.driver_id,
        marketplace_order_id: request.marketplace_order_id,
        agreed_fee: transportFee || 0,
        agreement_timestamp: new Date().toISOString(),
        delivery_status: "Assigned",
      } as any)
      .select()
      .single();

    if (taError) throw taError;

    await supabase
      .from("delivery_jobs")
      .update({ transport_agreement_id: (ta as any).id } as any)
      .eq("id", (job as any).id);

    await supabase
      .from("agtrans_requests")
      .update({ agreement_id: (ta as any).id } as any)
      .eq("id", request.id);

    await supabase
      .from("tracking_sessions")
      .insert({
        delivery_job_id: (job as any).id,
        driver_id: request.driver_id,
        driver_name: driver.full_name,
        vehicle_type: driver.vehicle_type,
        plate_number: driver.plate_number,
        pickup_location: request.pickup_location,
        destination: request.delivery_location,
        status: "active",
        // A pickup pin is not the truck's GPS position. Vehicle coordinates
        // remain empty until the driver explicitly shares a real GPS fix.
        current_lat: null,
        current_lon: null,
        speed_kn: null,
        heading: null,
        last_location_at: null,
        location_accuracy_m: null,
        location_source: "unverified",
        is_simulated: false,
        eta: null,
        distance_m: null,
      } as any);

    // Decrement remaining capacity
    const newCapacity = Math.max(0, (driver.remaining_capacity || 0) - (request.quantity || 0));
    await supabase
      .from("agtrans_drivers")
      .update({ remaining_capacity: newCapacity } as any)
      .eq("user_id", request.driver_id);

    return job;
  };

  const updateDeliveryJobStatus = async (jobId: string, status: DeliveryJob["status"]) => {
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("delivery_jobs")
      .update({ status } as any)
      .eq("id", jobId);

    if (error) throw error;

    const job = deliveryJobs.find((j) => j.id === jobId);
    if (job) {
      await supabase
        .from("transport_agreements")
        .update({ delivery_status: status } as any)
        .eq("request_id", job.request_id || "00000000-0000-0000-0000-000000000000");
    }

    if (status === "Delivered" && driverProfile) {
      const completed = (driverProfile.completed_deliveries || 0) + 1;
      const currentScore = driverProfile.reliability_score || 100;
      const nextScore = Math.min(100, currentScore + 2);
      await updateDriverProfile({
        completed_deliveries: completed,
        reliability_score: nextScore,
      });
    }

    if (status === "Delivered" || status === "Cancelled" || status === "Completed") {
      const nextStatus = status === "Cancelled" ? "cancelled" : "completed";
      await supabase
        .from("tracking_sessions")
        .update({ status: nextStatus } as any)
        .eq("delivery_job_id", jobId);
    }

    if (status === "Completed" && job) {
      await notifyUser(job.supplier_id, "delivery_completed", "Delivery Completed", `Delivery ${job.product} has been completed`);
      if (job.buyer_id) {
        await notifyUser(job.buyer_id, "buyer_confirmed_delivery", "Delivery Confirmed", `Your order ${job.product} has been delivered`);
      }
    }
  };

  const updateTrackingSessionLocation = async (jobId: string, locationData: {
    lat: number;
    lon: number;
    speed_kn?: number;
    heading?: number;
    accuracyM: number;
    source: "device_gps";
    capturedAt: string;
    eta?: string;
    distance_m?: number;
    route?: any;
  }) => {
    if (!Number.isFinite(locationData.lat) || locationData.lat < -90 || locationData.lat > 90
      || !Number.isFinite(locationData.lon) || locationData.lon < -180 || locationData.lon > 180) {
      throw new Error("The supplied driver GPS coordinates are invalid.");
    }
    if (!Number.isFinite(locationData.accuracyM) || locationData.accuracyM <= 0 || locationData.accuracyM > 100) {
      throw new Error("GPS accuracy is too low to publish this vehicle position.");
    }
    const capturedAtMs = Date.parse(locationData.capturedAt);
    const ageMs = Date.now() - capturedAtMs;
    if (!Number.isFinite(capturedAtMs) || ageMs > 90000 || ageMs < -15000) {
      throw new Error("The GPS fix is stale or has an invalid capture time. Request a fresh device GPS position.");
    }
    const { error } = await supabase
      .from("tracking_sessions")
      .update({
        current_lat: locationData.lat,
        current_lon: locationData.lon,
        speed_kn: locationData.speed_kn ?? null,
        heading: locationData.heading ?? null,
        last_location_at: locationData.capturedAt,
        location_accuracy_m: locationData.accuracyM,
        location_source: locationData.source,
        is_simulated: false,
        eta: locationData.eta,
        distance_m: locationData.distance_m,
        route: locationData.route,
      } as any)
      .eq("delivery_job_id", jobId)
      .eq("driver_id", user?.id);

    if (error) {
      console.error("Error updating live location:", error);
      throw new Error(error.message || "Could not update the vehicle GPS position.");
    }
  };

  const handleCancelTrip = async (jobId: string) => {
    if (!user || !driverProfile) throw new Error("Not authenticated");

    const cancellations = (driverProfile.cancellations || 0) + 1;
    const currentScore = driverProfile.reliability_score || 100;
    const nextScore = Math.max(0, currentScore - 15);
    const isSuspended = cancellations >= 3;

    const profileUpdates: Partial<DriverProfile> = {
      cancellations,
      reliability_score: nextScore,
      admin_suspended: isSuspended ? true : driverProfile.admin_suspended,
      notes: isSuspended
        ? "Suspended automatically for 30 days due to high cancellation count."
        : driverProfile.notes,
    };

    await updateDriverProfile(profileUpdates);
    await updateDeliveryJobStatus(jobId, "Cancelled");
  };

  const confirmDelivery = async (id: string) => {
    // id can be request id or delivery job id
    let requestId = id;
    const jobById = deliveryJobs.find((j) => j.id === id);
    if (jobById) requestId = jobById.request_id || id;

    const { error } = await supabase
      .from("agtrans_requests")
      .update({ status: "delivery_confirmed" } as any)
      .eq("id", requestId);

    if (error) throw error;

    const { data: jobs } = await supabase
      .from("delivery_jobs")
      .select("id")
      .eq("request_id", requestId);
    const jobIds = (jobs as any) || [];
    for (const job of jobIds) {
      await supabase.from("delivery_jobs").update({ status: "Completed" } as any).eq("id", job.id);
      await supabase.from("transport_agreements").update({ delivery_status: "Completed" } as any).eq("request_id", requestId);
    }

    const request = requests.find((r) => r.id === requestId);
    if (request?.driver_id) {
      await notifyUser(request.driver_id, "buyer_confirmed_delivery", "Buyer Confirmed Delivery", `Buyer confirmed delivery for ${request.tracking_code}`);
    }
  };

  const loadDriverHistory = useCallback(async () => {
    if (!user || !driverProfile) return;
    const [jobs, ratings] = await Promise.all([
      safeSelect<DeliveryJob>("delivery_jobs"),
      safeSelect<{ request_id: string; score: number; comment?: string; created_at: string }>("agtrans_ratings"),
    ]);
    const mine = jobs.filter((j) => j.driver_id === user.id);
    setHistory({
      completed: mine.filter((j) => j.status === "Completed" || j.status === "Delivered"),
      active: mine.filter((j) => j.status !== "Completed" && j.status !== "Delivered" && j.status !== "Cancelled"),
      cancelled: mine.filter((j) => j.status === "Cancelled"),
      ratings: ratings.filter((r) => r.request_id && mine.some((j) => j.request_id === r.request_id)),
    });
  }, [user, driverProfile]);

  return {
    requests,
    deliveryJobs,
    trackingSessions,
    drivers,
    loading,
    driverProfile,
    history,
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
    // transport offer
    publishOffer,
    updateOffer,
    pauseOffer,
    removeOffer,
    publishableOffers,
    // requests / negotiation
    sendTransportRequest,
    respondToRequest,
    respondToCounter,
    // history
    loadDriverHistory,
    reload: loadData,
  };
}
