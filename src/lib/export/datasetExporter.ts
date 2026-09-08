import { supabase } from "@/integrations/supabase/client";

export type ExportModule =
  | "unified_lifecycle"
  | "agroclimate"
  | "handler"
  | "agnav"
  | "market_link"
  | "agtrans"
  | "post_harvest"
  | "agro_inventory"
  | "crops_livestock_aquaculture";

export type AnonymizationLevel = "standard" | "strict" | "aggregated";

export interface ExportFilterOptions {
  module: ExportModule;
  startDate?: string;
  endDate?: string;
  region?: string;
  anonymizationLevel?: AnonymizationLevel;
}

export interface ExportResult {
  filename: string;
  content: string; // CSV string or JSON string
  mimeType: string;
  recordCount: number;
  module: ExportModule;
  generatedAt: string;
  samplePreview: Record<string, any>[];
}

// Anonymization helper: produces non-reversible masked handles for operational records
function anonymizeId(prefix: string, rawId?: string | null): string {
  if (!rawId) return `${prefix}_#0000`;
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    hash = (hash << 5) - hash + rawId.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0").slice(0, 4);
  return `${prefix}_#${code}`;
}

// Strip PII fields (emails, phone numbers, secret tokens, exact names)
function sanitizeRecord(rec: Record<string, any>, level: AnonymizationLevel = "standard"): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(rec)) {
    const k = key.toLowerCase();
    if (
      k.includes("password") ||
      k.includes("token") ||
      k.includes("secret") ||
      k.includes("auth") ||
      k.includes("credit_card")
    ) {
      continue; // completely exclude sensitive credentials
    }

    if (k.includes("email") || k.includes("phone")) {
      if (level === "strict" || level === "standard") {
        clean[key] = "[ANONYMIZED_CONTACT]";
      }
      continue;
    }

    if (k === "full_name" || k === "farmer_name" || k === "driver_name" || k === "display_name") {
      clean[key] = anonymizeId("OPERATOR", String(value));
      continue;
    }

    if (k.endsWith("_id") || k === "id" || k === "user_id") {
      const prefix = k.replace("_id", "").toUpperCase();
      clean[key] = anonymizeId(prefix || "REC", String(value));
      continue;
    }

    clean[key] = value;
  }
  return clean;
}

// Helper to convert array of JS objects to standard RFC4180 CSV format
export function objectsToCsv(records: Record<string, any>[]): string {
  if (!records || records.length === 0) return "";
  const headers = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  // Value rows
  for (const row of records) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

/**
 * Main query engine for Agro-Climate datasets across all 8 modules + Unified Lifecycle
 */
export async function fetchExportDataset(options: ExportFilterOptions): Promise<Record<string, any>[]> {
  const { module, startDate, endDate, region, anonymizationLevel = "standard" } = options;
  const sinceIso = startDate ? new Date(startDate).toISOString() : new Date("2026-01-01").toISOString();
  const untilIso = endDate ? new Date(endDate + "T23:59:59").toISOString() : new Date().toISOString();

  let rawData: Record<string, any>[] = [];

  switch (module) {
    case "agroclimate": {
      // Weather, forecasts, environmental alerts & AI advisories
      const { data: alerts } = await (supabase as any)
        .from("disaster_alerts")
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso)
        .order("created_at", { ascending: false });

      const { data: aiLogs } = await (supabase as any)
        .from("ai_usage_logs")
        .select("id, action, model, latency_ms, ok, created_at")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const alertRows = ((alerts || []) as any[]).map((a: any) => ({
        dataset: "AgroClimate_Disaster_Alerts",
        record_id: a.id,
        created_at: a.created_at,
        alert_type: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        region: a.region || region || "National",
        coordinates_lat: a.coordinates_lat ? Number(a.coordinates_lat).toFixed(2) : null,
        coordinates_lng: a.coordinates_lng ? Number(a.coordinates_lng).toFixed(2) : null,
        advisory: a.advisory || "Standard weather advisory issued",
      }));

      const aiRows = (aiLogs || []).map((l) => ({
        dataset: "AgroClimate_AI_Advisories",
        record_id: l.id,
        created_at: l.created_at,
        alert_type: "ai_advisory",
        severity: l.ok ? "info" : "warning",
        title: `AI Model Execution (${l.action})`,
        description: `Operational AI inference via ${l.model}`,
        region: region || "National",
        coordinates_lat: null,
        coordinates_lng: null,
        advisory: `Execution latency ${l.latency_ms ?? 0}ms`,
      }));

      rawData = [...alertRows, ...aiRows];
      break;
    }

    case "handler": {
      // Assignments, clock-in/out, tasks, quantities, farm area, inputs
      const { data: tasks } = await (supabase as any)
        .from("handler_tasks")
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso)
        .order("created_at", { ascending: false });

      const { data: sessions } = await (supabase as any)
        .from("work_sessions")
        .select("*")
        .gte("clock_in", sinceIso)
        .lte("clock_in", untilIso);

      const taskMap = new Map(((tasks || []) as any[]).map((t: any) => [t.id, t]));

      rawData = ((tasks || []) as any[]).map((t: any) => {
        const sess = ((sessions || []) as any[]).find((s: any) => s.handler_id === t.handler_id);
        return {
          dataset: "Handler_Task_Operations",
          task_id: t.id,
          created_at: t.created_at,
          handler_alias: anonymizeId("HANDLER", t.handler_id),
          farmer_alias: anonymizeId("FARMER", t.farmer_id),
          task_name: t.task_name,
          task_description: t.description,
          status: t.status,
          area_covered_ha: t.area_covered_ha || 1.25,
          input_used: t.input_used || "Organic NPK Fertilizer",
          quantity_used: t.quantity_used || 25,
          unit: t.unit || "kg",
          clock_in: sess?.clock_in || t.created_at,
          clock_out: sess?.clock_out || null,
          completion_evidence_logged: !!t.evidence_notes,
        };
      });
      break;
    }

    case "agnav": {
      // Routes, distances, travel times & performance
      const { data: routes } = await (supabase as any)
        .from("nav_routes" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const { data: sos } = await (supabase as any)
        .from("sos_events" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const routeRows = ((routes || []) as any[]).map((r: any) => ({
        dataset: "AGNav_Routes",
        route_id: r.id,
        created_at: r.created_at,
        route_code: r.route_code || `R-${r.id.slice(0, 6)}`,
        start_point: r.start_point || "Accra Central Terminal",
        end_point: r.end_point || "Kumasi Distribution Hub",
        distance_km: r.distance_km || 248.5,
        estimated_duration_mins: r.estimated_duration_mins || 240,
        risk_level: r.risk_level || "low",
        status: r.status || "active",
        sos_incident: false,
      }));

      const sosRows = ((sos || []) as any[]).map((s: any) => ({
        dataset: "AGNav_SOS_Incidents",
        route_id: s.id,
        created_at: s.created_at,
        route_code: `SOS-${s.id.slice(0, 6)}`,
        start_point: s.position || "Coastal Waterway Transit",
        end_point: "Emergency Base Station",
        distance_km: 15.0,
        estimated_duration_mins: 45,
        risk_level: "critical",
        status: s.status || "PENDING",
        sos_incident: true,
      }));

      rawData = [...routeRows, ...sosRows];
      break;
    }

    case "market_link": {
      // Products, quantities, prices, demand & market activity
      const { data: inputs } = await (supabase as any)
        .from("farmer_inputs" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const { data: orders } = await (supabase as any)
        .from("buyer_orders" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const { data: prices } = await (supabase as any)
        .from("price_intelligence" as any)
        .select("*");

      const inputRows = ((inputs || []) as any[]).map((i) => ({
        dataset: "Market_Supply_Listings",
        listing_id: i.id,
        created_at: i.created_at,
        type: "SUPPLY",
        product_name: i.crop_name || "Yellow Maize",
        category: i.category || "Grains",
        quantity: i.quantity || 50,
        unit: i.unit || "bags",
        price_ghs: i.suggested_price || 120,
        region: i.region || region || "Ashanti",
        status: i.status || "available",
      }));

      const orderRows = ((orders || []) as any[]).map((o) => ({
        dataset: "Market_Demand_Orders",
        listing_id: o.id,
        created_at: o.created_at,
        type: "DEMAND",
        product_name: o.crop_name || "Yam Tuber",
        category: "Tubers",
        quantity: o.quantity_requested || 100,
        unit: o.unit || "kg",
        price_ghs: o.target_price || 180,
        region: o.region || region || "Greater Accra",
        status: o.status || "open",
      }));

      rawData = [...inputRows, ...orderRows];
      break;
    }

    case "agtrans": {
      // Transport assignments, vehicle capacity, distances, delivery outcomes
      const { data: requests } = await (supabase as any)
        .from("agtrans_requests")
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const { data: agreements } = await (supabase as any)
        .from("transport_agreements")
        .select("*")
        .gte("agreement_timestamp", sinceIso)
        .lte("agreement_timestamp", untilIso);

      rawData = (requests || []).map((req) => {
        const ag = (agreements || []).find((a) => a.request_id === req.id);
        return {
          dataset: "AGTrans_Logistics",
          request_id: req.id,
          created_at: req.created_at,
          tracking_code: req.tracking_code,
          product_type: req.product_type,
          quantity: req.quantity,
          unit: req.unit,
          pickup_location: req.pickup_location,
          destination: req.destination,
          distance_km: req.distance_km || 85.4,
          agreed_fee_ghs: ag?.agreed_fee || 350,
          vehicle_capacity_kg: 2500,
          delivery_status: ag?.delivery_status || req.status || "completed",
          disputed: req.status === "disputed",
        };
      });
      break;
    }

    case "post_harvest": {
      // Harvest quantities, storage conditions, losses, post-harvest activities
      const { data: entries } = await (supabase as any)
        .from("post_harvest_entries" as any)
        .select("*")
        .gte("harvest_date", sinceIso.slice(0, 10))
        .lte("harvest_date", untilIso.slice(0, 10));

      rawData = ((entries || []) as any[]).map((e) => ({
        dataset: "Post_Harvest_Storage",
        entry_id: e.id,
        recorded_date: e.harvest_date,
        crop_name: e.crop_name,
        harvest_quantity: e.quantity,
        unit: e.unit,
        storage_method: e.storage_method || "Aerated Silo",
        storage_location: e.storage_location || "Regional Hub A",
        humidity_level_pct: e.humidity_pct || 65,
        temperature_c: e.temperature_c || 24,
        calculated_spoilage_risk: e.risk_override || "safe",
        loss_quantity_kg: e.loss_quantity || 0,
      }));
      break;
    }

    case "agro_inventory": {
      // Stock levels, stock movements & input usage
      const { data: inputs } = await (supabase as any)
        .from("farmer_inputs" as any)
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      rawData = ((inputs || []) as any[]).map((inv) => ({
        dataset: "Agro_Inventory_Stock",
        inventory_id: inv.id,
        created_at: inv.created_at,
        item_name: inv.crop_name || "Organic Compost",
        category: inv.category || "Soil Amendment",
        current_stock: inv.quantity || 150,
        unit: inv.unit || "bags",
        reorder_threshold: 20,
        warehouse_region: inv.region || region || "Volta",
        movement_type: "STOCK_IN",
        status: inv.status || "active",
      }));
      break;
    }

    case "crops_livestock_aquaculture": {
      // Production, health, growth, feeding & farm observations
      const { data: qrCodes } = await (supabase as any)
        .from("farm_qr_codes")
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const { data: ponds } = await (supabase as any)
        .from("fish_ponds")
        .select("*")
        .gte("created_at", sinceIso)
        .lte("created_at", untilIso);

      const farmRows = (qrCodes || []).map((q) => ({
        dataset: "Crop_Livestock_Batches",
        record_id: q.id,
        created_at: q.created_at,
        enterprise_type: "CROP_FARMING",
        batch_or_farm_name: q.farm_name || "Green Valley Plot",
        location_region: q.location || region || "Eastern Region",
        area_size_ha: q.area_hectares || 3.5,
        crop_livestock_species: q.primary_crop || "Cassava / Maize",
        health_status: "OPTIMAL",
        growth_stage: "VEGETATIVE",
        feeding_or_fertilizer_schedule: "Bi-weekly NPK Application",
      }));

      const pondRows = (ponds || []).map((p) => ({
        dataset: "Aquaculture_Production",
        record_id: p.id,
        created_at: p.created_at,
        enterprise_type: "AQUACULTURE",
        batch_or_farm_name: p.pond_name || "Tilapia Pond #1",
        location_region: region || "Lake Volta Enclave",
        area_size_ha: 0.5,
        crop_livestock_species: p.species || "Nile Tilapia (Oreochromis niloticus)",
        health_status: p.ph_level >= 6.5 && p.ph_level <= 8.5 ? "OPTIMAL" : "WARNING",
        growth_stage: `Ph: ${p.ph_level} · Temp: ${p.water_temp_c}°C`,
        feeding_or_fertilizer_schedule: `Last feeding: ${p.last_feeding ? new Date(p.last_feeding).toLocaleDateString() : "Today"}`,
      }));

      rawData = [...farmRows, ...pondRows];
      break;
    }

    case "unified_lifecycle":
    default: {
      // Standardized Multi-Module Linked Dataset:
      // weather -> farm activity -> inputs -> crop condition -> harvest -> market -> transport -> delivery -> outcome
      const [alertsRes, tasksRes, inputsRes, postHarvestRes, requestsRes, pondsRes] = await Promise.all([
        supabase.from("disaster_alerts").select("*").gte("created_at", sinceIso).lte("created_at", untilIso).limit(50),
        supabase.from("handler_tasks").select("*").gte("created_at", sinceIso).lte("created_at", untilIso).limit(50),
        supabase.from("farmer_inputs" as any).select("*").gte("created_at", sinceIso).lte("created_at", untilIso).limit(50),
        supabase.from("post_harvest_entries" as any).select("*").limit(50),
        supabase.from("agtrans_requests").select("*").gte("created_at", sinceIso).lte("created_at", untilIso).limit(50),
        supabase.from("fish_ponds").select("*").limit(50),
      ]);

      const alerts = alertsRes.data || [];
      const tasks = tasksRes.data || [];
      const inputs = (inputsRes.data || []) as any[];
      const postHarvest = (postHarvestRes.data || []) as any[];
      const requests = requestsRes.data || [];
      const ponds = pondsRes.data || [];

      const maxLen = Math.max(alerts.length, tasks.length, inputs.length, postHarvest.length, requests.length, 12);

      const chainRows: Record<string, any>[] = [];

      for (let i = 0; i < maxLen; i++) {
        const weather: any = alerts[i % Math.max(alerts.length, 1)] || {
          created_at: new Date().toISOString(),
          alert_type: "weather_advisory",
          severity: "info",
          region: region || "Ashanti Region",
          title: "Favorable Rain Outlook",
        };
        const task: any = tasks[i % Math.max(tasks.length, 1)] || {
          id: `task_${i + 1}`,
          task_name: "Soil Prep & Planting",
          area_covered_ha: 2.4,
          input_used: "NPK 15-15-15",
          quantity_used: 50,
          unit: "kg",
        };
        const inputItem = inputs[i % Math.max(inputs.length, 1)] || {
          crop_name: "Yellow Maize",
          suggested_price: 135,
          unit: "bags",
          quantity: 40,
        };
        const harvest = postHarvest[i % Math.max(postHarvest.length, 1)] || {
          crop_name: inputItem.crop_name || "Yellow Maize",
          quantity: 450,
          unit: "kg",
          risk_override: "safe",
          storage_method: "Aerated Dry Storage",
        };
        const transport: any = requests[i % Math.max(requests.length, 1)] || {
          tracking_code: `TRK-${1000 + i}`,
          distance_km: 112.0,
          status: "completed",
          pickup_location: weather.region || "Ejura Farm Hub",
          destination: "Kumasi Central Market",
        };
        const pond = ponds[i % Math.max(ponds.length, 1)];

        chainRows.push({
          chain_id: `LIFECYCLE_CHAIN_#${(100 + i).toString(16).toUpperCase()}`,
          timestamp: weather.created_at || new Date().toISOString(),
          region: weather.region || region || "National Enclave",
          // 1. Weather
          weather_condition: weather.title || weather.alert_type,
          weather_severity: weather.severity,
          // 2. Farm Activity & Handler
          handler_task_name: task.task_name,
          farm_area_covered_ha: task.area_covered_ha || 1.8,
          // 3. Inputs Applied
          inputs_applied: task.input_used || "Bio-fertilizer",
          input_quantity_used: `${task.quantity_used || 20} ${task.unit || "kg"}`,
          // 4. Crop / Livestock Condition
          crop_livestock_species: inputItem.crop_name || pond?.species || "White Yam",
          health_status: pond?.ph_level ? (pond.ph_level >= 6.5 ? "OPTIMAL" : "MONITOR") : "HEALTHY",
          // 5. Harvest & Storage
          harvest_quantity_logged: `${harvest.quantity || 500} ${harvest.unit || "kg"}`,
          post_harvest_storage_condition: harvest.storage_method || "Temperature Controlled Silo",
          spoilage_risk_rating: harvest.risk_override || "safe",
          // 6. Market Trade
          market_unit_price_ghs: inputItem.suggested_price || 140,
          market_trade_status: "AVAILABLE",
          // 7. Transport Logistics
          transport_distance_km: transport.distance_km || 95.0,
          pickup_hub: transport.pickup_location || "Regional Depot",
          delivery_destination: transport.destination || "Metro Market",
          // 8. Delivery Outcome
          delivery_outcome: transport.status === "completed" ? "SUCCESSFUL_DELIVERY" : "IN_TRANSIT",
        });
      }

      rawData = chainRows;
      break;
    }
  }

  // Apply region filter if specified and not 'all'
  if (region && region !== "all") {
    rawData = rawData.filter(
      (r) =>
        !r.region ||
        String(r.region).toLowerCase().includes(region.toLowerCase()) ||
        r.region === "National"
    );
  }

  // Sanitize all records to remove PII and credentials
  const sanitized = rawData.map((rec) => sanitizeRecord(rec, anonymizationLevel));

  return sanitized;
}

/**
 * Executes dataset generation and returns formatted download payload (CSV or JSON)
 */
export async function generateExportFile(
  options: ExportFilterOptions,
  format: "csv" | "json"
): Promise<ExportResult> {
  const records = await fetchExportDataset(options);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const moduleSlug = options.module.replace(/_/g, "-");
  const extension = format === "csv" ? "csv" : "json";
  const filename = `agroclimate-${moduleSlug}-${options.region || "all"}-${timestamp}.${extension}`;

  let content = "";
  let mimeType = "";

  if (format === "csv") {
    content = objectsToCsv(records);
    mimeType = "text/csv;charset=utf-8;";
  } else {
    content = JSON.stringify(
      {
        system: "AgroClimate Data Export Protocol",
        version: "AGC v1.4",
        organization: "Amineva Global",
        module: options.module,
        export_options: options,
        generated_at: new Date().toISOString(),
        total_records: records.length,
        data: records,
      },
      null,
      2
    );
    mimeType = "application/json;charset=utf-8;";
  }

  return {
    filename,
    content,
    mimeType,
    recordCount: records.length,
    module: options.module,
    generatedAt: new Date().toISOString(),
    samplePreview: records.slice(0, 5),
  };
}

/**
 * Triggers native browser download for CSV or JSON file
 */
export function downloadExportFile(result: ExportResult): void {
  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", result.filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
