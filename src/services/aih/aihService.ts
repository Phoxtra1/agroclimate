import {
  AircraftAsset,
  AircraftProtocol,
  AircraftType,
  UniversalTelemetry,
  CommandType,
  CameraSensorSource,
  StreamProtocol,
  StreamHealth
} from "./types";
import { AircraftRegistryManager } from "./aircraftRegistry";
import { TelemetryGateway } from "./telemetryGateway";
import { CommandCenter } from "./commandCenter";

export class AirIntegrationHub {
  private static activeAircraft: AircraftAsset | null = null;
  private static isSimulator: boolean = true;
  private static activeSensor: CameraSensorSource = "rgb";
  private static cameraProtocol: StreamProtocol = "rtsp";

  // Event handlers for state changes
  private static stateListeners = new Set<(state: {
    activeAircraft: AircraftAsset | null;
    isSimulator: boolean;
    activeSensor: CameraSensorSource;
    cameraProtocol: StreamProtocol;
  }) => void>();

  static addListener(cb: (state: any) => void) {
    this.stateListeners.add(cb);
    cb(this.getState());
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  private static notify() {
    const state = this.getState();
    this.stateListeners.forEach(cb => cb(state));
  }

  static getState() {
    return {
      activeAircraft: this.activeAircraft,
      isSimulator: this.isSimulator,
      activeSensor: this.activeSensor,
      cameraProtocol: this.cameraProtocol,
    };
  }

  static toggleSimulatorMode(on: boolean) {
    this.isSimulator = on;
    this.notify();
    
    if (this.activeAircraft) {
      if (on) {
        // Start simulation loops
        TelemetryGateway.startSimulation(
          this.activeAircraft.id,
          this.activeAircraft.type
        );
      } else {
        // Disconnect simulation loops
        TelemetryGateway.stopSimulation(this.activeAircraft.id);
        TelemetryGateway.updateTelemetry(this.activeAircraft.id, {
          connectionStatus: "disconnected",
          gpsStatus: "none",
        });
      }
    }
  }

  static changeSensor(sensor: CameraSensorSource) {
    this.activeSensor = sensor;
    this.notify();
  }

  static changeCameraProtocol(protocol: StreamProtocol) {
    this.cameraProtocol = protocol;
    this.notify();
  }

  /**
   * Connection Manager: Discover Aircraft
   */
  static async discoverAircraft(protocol: AircraftProtocol): Promise<AircraftAsset[]> {
    const all = await AircraftRegistryManager.getAircrafts();
    return all.filter(a => a.protocol === protocol || protocol === "custom");
  }

  /**
   * Connection Manager: Connect
   */
  static async connect(aircraftId: string): Promise<void> {
    const all = await AircraftRegistryManager.getAircrafts();
    const asset = all.find(a => a.id === aircraftId);
    if (!asset) throw new Error("Aircraft not found in registry");

    this.activeAircraft = { ...asset, status: "connecting" };
    this.notify();

    // Log connection attempt
    await AircraftRegistryManager.addHistoryLog(
      aircraftId,
      "connection_attempt",
      `Connecting to aircraft via protocol ${asset.protocol.toUpperCase()}...`
    );

    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 1000));

    this.activeAircraft.status = "connected";
    this.activeAircraft.lastConnected = new Date().toISOString();
    this.notify();

    // Update the registry
    await AircraftRegistryManager.updateAircraft(aircraftId, {
      status: "connected",
      lastConnected: this.activeAircraft.lastConnected,
    });

    await AircraftRegistryManager.addHistoryLog(
      aircraftId,
      "connected",
      `Connection established with signal strength 95%.`
    );

    if (this.isSimulator) {
      TelemetryGateway.startSimulation(aircraftId, asset.type);
    } else {
      // Live operations telemetry setup (waiting for actual socket payload)
      TelemetryGateway.updateTelemetry(aircraftId, {
        aircraftId,
        aircraftType: asset.type,
        connectionStatus: "connected",
        gpsStatus: "3d",
        altitude: 0,
        speed: 0,
        batteryFuelStatus: 85,
        signalStrength: 92,
      });
    }
  }

  /**
   * Connection Manager: Disconnect
   */
  static async disconnect(): Promise<void> {
    if (!this.activeAircraft) return;

    const aircraftId = this.activeAircraft.id;
    
    // Stop telemetry loops
    TelemetryGateway.stopSimulation(aircraftId);
    TelemetryGateway.clear(aircraftId);

    // Update status to disconnected
    await AircraftRegistryManager.updateAircraft(aircraftId, {
      status: "disconnected",
    });

    await AircraftRegistryManager.addHistoryLog(
      aircraftId,
      "disconnected",
      "Manual disconnect initiated by operator."
    );

    this.activeAircraft = null;
    this.notify();
  }

  /**
   * Command Center bridge
   */
  static async issueCommand(
    command: CommandType,
    params?: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    if (!this.activeAircraft) {
      return { success: false, message: "No active aircraft connected." };
    }
    return CommandCenter.sendCommand(this.activeAircraft, command, params);
  }

  /**
   * Live Video & Sensor stream metrics calculation
   */
  static getStreamHealth(): StreamHealth {
    if (!this.activeAircraft) {
      return { fps: 0, bitrateKbps: 0, latencyMs: 0, packetLossPct: 0, signalQuality: 0 };
    }

    if (this.isSimulator) {
      // Simulate healthy stream parameters
      const qualityFluc = Math.random() * 4;
      return {
        fps: 30,
        bitrateKbps: 1800 + Math.floor(Math.random() * 200),
        latencyMs: 45 + Math.floor(Math.random() * 15),
        packetLossPct: 0.1 + Math.random() * 0.2,
        signalQuality: Math.floor(92 - qualityFluc),
      };
    } else {
      // Live operations stream health (slightly more volatile based on protocol)
      const isMavlink = this.activeAircraft.protocol === "mavlink";
      return {
        fps: isMavlink ? 15 : 24,
        bitrateKbps: isMavlink ? 350 : 1200 + Math.floor(Math.random() * 300),
        latencyMs: isMavlink ? 180 : 80 + Math.floor(Math.random() * 40),
        packetLossPct: isMavlink ? 1.5 : 0.8,
        signalQuality: 80,
      };
    }
  }

  /**
   * FUTURE AI READINESS
   * Preparation hooks for Dipa AI Integration
   */
  static prepareDipaAiHook(
    capability:
      | "crop_monitoring"
      | "flood_detection"
      | "environmental"
      | "infrastructure"
      | "disaster"
      | "fisheries"
      | "wildlife"
      | "airspace",
    aircraftId: string
  ): {
    hookId: string;
    prepared: boolean;
    description: string;
    pipelineUrl: string;
  } {
    console.log(`[AIH Dipa AI] Preparing integration hook for pipeline: ${capability} on asset: ${aircraftId}`);
    
    const capabilitiesMap: Record<string, string> = {
      crop_monitoring: "Crop Stress & Yield Prediction Model (Dipa v2.4)",
      flood_detection: "Terrace Flooding & Saturation Analysis (Dipa Hydrology)",
      environmental: "CO2 Canopy & Air Quality Sensors Ingestion",
      infrastructure: "Thermal Power & Irrigation Line Fault Detection",
      disaster: "Wildfire & Flood Devastation Rapid Area Mapping",
      fisheries: "Coastal Patrolling Vessel & Fish Swarm Spotter",
      wildlife: "Migration Tracking & Anti-Poaching Thermal Spotter",
      airspace: "Universal Aircraft Conflict Resolution & Collision Deconfliction",
    };

    return {
      hookId: `dipa-hook-${capability}-${crypto.randomUUID().slice(0, 8)}`,
      prepared: true,
      description: `Hook prepared for: ${capabilitiesMap[capability] || capability}. Fully configured to ingest telemetry from asset ${aircraftId}.`,
      pipelineUrl: `/api/v1/ai/hooks/dipa/${capability}?aircraft_id=${aircraftId}`,
    };
  }
}
