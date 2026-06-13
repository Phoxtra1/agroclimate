import { supabase } from "@/integrations/supabase/client";
import { AircraftAsset, AircraftType, AircraftProtocol } from "./types";

const LOCAL_STORAGE_KEY = "aih_aircraft_registry";
const HISTORY_STORAGE_KEY = "aih_flight_history";

export interface FlightHistoryItem {
  id: string;
  aircraftId: string;
  aircraftName: string;
  eventType: string;
  timestamp: string;
  details: string;
}

const DEFAULT_AIRCRAFT: AircraftAsset[] = [
  {
    id: "active-drone-1",
    name: "Odeneho Multi-Spectral UAV",
    type: "drone",
    manufacturer: "Amineva Systems",
    model: "AgroCop-X4",
    protocol: "simulator",
    status: "disconnected",
    lastConnected: null,
    operator: "Kofi Mensah",
    homeBase: "Kumasi North Station",
  },
  {
    id: "active-heli-1",
    name: "Agro-Chop Air Rescue 5",
    type: "air_ambulance",
    manufacturer: "Eurocopter",
    model: "EC135",
    protocol: "adsb",
    status: "disconnected",
    lastConnected: null,
    operator: "Dr. Ama Osei",
    homeBase: "Accra Central Heliport",
  },
  {
    id: "active-fixed-1",
    name: "Cargo Freight Courier A",
    type: "cargo",
    manufacturer: "Cessna",
    model: "Grand Caravan 208B",
    protocol: "mavlink",
    status: "disconnected",
    lastConnected: null,
    operator: "Kwame Boateng",
    homeBase: "Tamale Cargo Terminal",
  }
];

export class AircraftRegistryManager {
  private static getLocalAircrafts(): AircraftAsset[] {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_AIRCRAFT));
      return DEFAULT_AIRCRAFT;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_AIRCRAFT;
    }
  }

  private static saveLocalAircrafts(aircrafts: AircraftAsset[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(aircrafts));
  }

  static async getAircrafts(): Promise<AircraftAsset[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getLocalAircrafts();
      }
      
      const { data, error } = await supabase
        .from("aircraft_registry" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        // If empty in cloud, sync local aircrafts
        const locals = this.getLocalAircrafts();
        for (const loc of locals) {
          await this.registerAircraft(loc);
        }
        return locals;
      }

      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type as AircraftType,
        manufacturer: item.manufacturer,
        model: item.model,
        protocol: item.protocol as AircraftProtocol,
        status: item.status,
        lastConnected: item.last_connected,
        operator: item.operator || "Unknown",
        homeBase: item.home_base || "Ground Control",
        metadata: item.metadata,
      }));
    } catch (err) {
      console.warn("AIH Registry: Using LocalStorage fallback:", err);
      return this.getLocalAircrafts();
    }
  }

  static async registerAircraft(
    aircraft: Omit<AircraftAsset, "id" | "status" | "lastConnected"> & { id?: string }
  ): Promise<AircraftAsset> {
    const id = aircraft.id || crypto.randomUUID();
    const newAsset: AircraftAsset = {
      ...aircraft,
      id,
      status: "disconnected",
      lastConnected: null,
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("aircraft_registry" as any)
        .insert({
          id: newAsset.id,
          user_id: user.id,
          name: newAsset.name,
          type: newAsset.type,
          manufacturer: newAsset.manufacturer,
          model: newAsset.model,
          protocol: newAsset.protocol,
          status: newAsset.status,
          operator: newAsset.operator,
          home_base: newAsset.homeBase,
          metadata: newAsset.metadata || {},
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
    } catch (err) {
      console.warn("AIH Registry: Register saved to LocalStorage:", err);
      const locals = this.getLocalAircrafts();
      locals.unshift(newAsset);
      this.saveLocalAircrafts(locals);
    }

    // Log the event
    await this.addHistoryLog(id, "registration", `Aircraft ${aircraft.name} registered successfully.`);
    return newAsset;
  }

  static async updateAircraft(id: string, updates: Partial<AircraftAsset>): Promise<AircraftAsset> {
    let updatedAsset: AircraftAsset | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.manufacturer !== undefined) dbUpdates.manufacturer = updates.manufacturer;
      if (updates.model !== undefined) dbUpdates.model = updates.model;
      if (updates.protocol !== undefined) dbUpdates.protocol = updates.protocol;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.lastConnected !== undefined) dbUpdates.last_connected = updates.lastConnected;
      if (updates.operator !== undefined) dbUpdates.operator = updates.operator;
      if (updates.homeBase !== undefined) dbUpdates.home_base = updates.homeBase;
      if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

      if (!user) throw new Error("No user");

      const { data, error } = await supabase
        .from("aircraft_registry" as any)
        .update(dbUpdates)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (data) {
        updatedAsset = {
          id: data.id,
          name: data.name,
          type: data.type as AircraftType,
          manufacturer: data.manufacturer,
          model: data.model,
          protocol: data.protocol as AircraftProtocol,
          status: data.status,
          lastConnected: data.last_connected,
          operator: data.operator,
          homeBase: data.home_base,
          metadata: data.metadata,
        };
      }
    } catch (err) {
      console.warn("AIH Registry: Update saved to LocalStorage:", err);
    }

    // Sync LocalStorage
    const locals = this.getLocalAircrafts();
    const idx = locals.findIndex(a => a.id === id);
    if (idx !== -1) {
      locals[idx] = { ...locals[idx], ...updates };
      updatedAsset = locals[idx];
      this.saveLocalAircrafts(locals);
    }

    return updatedAsset || { id, ...updates } as AircraftAsset;
  }

  static async removeAircraft(id: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("aircraft_registry" as any)
          .delete()
          .eq("id", id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("AIH Registry: Deleted from LocalStorage:", err);
    }

    const locals = this.getLocalAircrafts();
    const filtered = locals.filter(a => a.id !== id);
    this.saveLocalAircrafts(filtered);
  }

  static async getFlightHistory(aircraftId?: string): Promise<FlightHistoryItem[]> {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!data) return [];
    try {
      const items: FlightHistoryItem[] = JSON.parse(data);
      if (aircraftId) {
        return items.filter(i => i.aircraftId === aircraftId);
      }
      return items;
    } catch {
      return [];
    }
  }

  static async addHistoryLog(aircraftId: string, eventType: string, details: string): Promise<void> {
    const aircrafts = this.getLocalAircrafts();
    const asset = aircrafts.find(a => a.id === aircraftId);
    const aircraftName = asset ? asset.name : "Unknown Aircraft";

    const newItem: FlightHistoryItem = {
      id: crypto.randomUUID(),
      aircraftId,
      aircraftName,
      eventType,
      timestamp: new Date().toISOString(),
      details,
    };

    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    let items: FlightHistoryItem[] = [];
    if (data) {
      try {
        items = JSON.parse(data);
      } catch {}
    }
    items.unshift(newItem);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 100))); // Cap at 100 entries
  }
}
