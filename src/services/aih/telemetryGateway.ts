import { UniversalTelemetry, AircraftType, AircraftStatus, FlightMode, GpsFix } from "./types";

type TelemetryCallback = (telemetry: UniversalTelemetry) => void;

interface SimulationConfig {
  speed: number; // m/s
  maxAlt: number; // m
  batteryDecay: number; // % per tick
  gpsFix: GpsFix;
}

const VEHICLE_CONFIGS: Record<AircraftType, SimulationConfig> = {
  drone: { speed: 12, maxAlt: 120, batteryDecay: 0.04, gpsFix: "3d" },
  helicopter: { speed: 75, maxAlt: 800, batteryDecay: 0.015, gpsFix: "3d" },
  fixed_wing: { speed: 55, maxAlt: 600, batteryDecay: 0.02, gpsFix: "3d" },
  air_ambulance: { speed: 80, maxAlt: 900, batteryDecay: 0.012, gpsFix: "rtk" },
  cargo: { speed: 65, maxAlt: 1500, batteryDecay: 0.01, gpsFix: "3d" },
  evtol: { speed: 32, maxAlt: 300, batteryDecay: 0.05, gpsFix: "rtk" },
  survey: { speed: 18, maxAlt: 150, batteryDecay: 0.035, gpsFix: "rtk" },
  maritime_patrol: { speed: 90, maxAlt: 1200, batteryDecay: 0.008, gpsFix: "3d" },
  custom: { speed: 20, maxAlt: 200, batteryDecay: 0.03, gpsFix: "2d" },
};

export class TelemetryGateway {
  private static subscribers = new Map<string, Set<TelemetryCallback>>();
  private static latestTelemetry = new Map<string, UniversalTelemetry>();
  private static simIntervals = new Map<string, ReturnType<typeof setInterval>>();

  static subscribe(aircraftId: string, callback: TelemetryCallback): () => void {
    if (!this.subscribers.has(aircraftId)) {
      this.subscribers.set(aircraftId, new Set());
    }
    this.subscribers.get(aircraftId)!.add(callback);

    // Immediately push latest telemetry if available
    const latest = this.latestTelemetry.get(aircraftId);
    if (latest) {
      callback({ ...latest });
    }

    return () => {
      const subs = this.subscribers.get(aircraftId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(aircraftId);
        }
      }
    };
  }

  static getLatestTelemetry(aircraftId: string): UniversalTelemetry | null {
    return this.latestTelemetry.get(aircraftId) || null;
  }

  static updateTelemetry(aircraftId: string, telemetry: Partial<UniversalTelemetry>) {
    const existing = this.latestTelemetry.get(aircraftId) || {
      aircraftId,
      aircraftType: "drone" as AircraftType,
      latitude: 5.6037,
      longitude: -0.1870,
      altitude: 0,
      speed: 0,
      heading: 0,
      batteryFuelStatus: 100,
      signalStrength: 100,
      flightMode: "manual" as FlightMode,
      gpsStatus: "none" as GpsFix,
      connectionStatus: "disconnected" as AircraftStatus,
      timestamp: new Date().toISOString(),
    };

    const updated: UniversalTelemetry = {
      ...existing,
      ...telemetry,
      timestamp: new Date().toISOString(),
    };

    this.latestTelemetry.set(aircraftId, updated);

    // Notify all subscribers
    const subs = this.subscribers.get(aircraftId);
    if (subs) {
      subs.forEach(cb => cb({ ...updated }));
    }
  }

  static startSimulation(aircraftId: string, aircraftType: AircraftType, startingLat = 5.6037, startingLng = -0.1870) {
    this.stopSimulation(aircraftId);

    const config = VEHICLE_CONFIGS[aircraftType] || VEHICLE_CONFIGS.drone;

    // Initial Telemetry setup
    this.updateTelemetry(aircraftId, {
      aircraftId,
      aircraftType,
      latitude: startingLat,
      longitude: startingLng,
      altitude: 0,
      speed: 0,
      heading: 0,
      batteryFuelStatus: 100,
      signalStrength: 95,
      flightMode: "manual" as FlightMode,
      gpsStatus: config.gpsFix,
      connectionStatus: "connected",
    });

    const homeLat = startingLat;
    const homeLng = startingLng;

    const interval = setInterval(() => {
      const current = this.latestTelemetry.get(aircraftId);
      if (!current) return;

      let { latitude, longitude, altitude, speed, heading, batteryFuelStatus, flightMode, signalStrength } = current;

      const isFlying = ["auto", "guided", "rtl", "emergency"].includes(flightMode) || (flightMode === "manual" && altitude > 0);

      if (isFlying) {
        // Battery/fuel decay
        batteryFuelStatus = Math.max(0, batteryFuelStatus - config.batteryDecay);

        if (flightMode === "rtl") {
          // Return to home physics
          const dx = homeLng - (longitude || 0);
          const dy = homeLat - (latitude || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.0001) {
            // Arrived at home, descent
            speed = 0;
            if (altitude > 0) {
              altitude = Math.max(0, altitude - 1.5);
              flightMode = "land";
            } else {
              flightMode = "manual";
              this.updateTelemetry(aircraftId, { connectionStatus: "connected" });
            }
          } else {
            // Heading towards home base
            heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            speed = config.speed;
            altitude = Math.min(config.maxAlt, altitude + 1); // climb/maintain
            
            // Move coordinate
            const moveScale = 0.000003 * speed;
            latitude = (latitude || 0) + Math.cos(heading * Math.PI / 180) * moveScale;
            longitude = (longitude || 0) + Math.sin(heading * Math.PI / 180) * moveScale;
          }
        } else if (flightMode === "land") {
          // Landing
          speed = 0;
          altitude = Math.max(0, altitude - 1.2);
          if (altitude === 0) {
            flightMode = "manual";
          }
        } else if (flightMode === "emergency") {
          // Emergency land
          speed = 0;
          altitude = Math.max(0, altitude - 2.5);
          if (altitude === 0) {
            flightMode = "manual";
          }
        } else {
          // Normal simulated flight dynamics (random path navigation or mission grids)
          speed = config.speed + (Math.random() * 4 - 2);
          heading = (heading + (Math.random() * 8 - 4) + 360) % 360;
          altitude = Math.min(config.maxAlt, Math.max(10, altitude + (Math.random() * 2 - 1)));

          const moveScale = 0.0000025 * speed;
          latitude = (latitude || 0) + Math.cos(heading * Math.PI / 180) * moveScale;
          longitude = (longitude || 0) + Math.sin(heading * Math.PI / 180) * moveScale;
        }
      } else {
        // Not flying, on ground
        speed = 0;
        altitude = 0;
      }

      // Signal Strength drift
      signalStrength = Math.min(100, Math.max(30, signalStrength + (Math.random() * 4 - 2)));

      this.updateTelemetry(aircraftId, {
        latitude,
        longitude,
        altitude,
        speed,
        heading,
        batteryFuelStatus,
        flightMode,
        signalStrength,
      });
    }, 500);

    this.simIntervals.set(aircraftId, interval);
  }

  static stopSimulation(aircraftId: string) {
    const interval = this.simIntervals.get(aircraftId);
    if (interval) {
      clearInterval(interval);
      this.simIntervals.delete(aircraftId);
    }
  }

  static clear(aircraftId: string) {
    this.stopSimulation(aircraftId);
    this.latestTelemetry.delete(aircraftId);
  }
}
