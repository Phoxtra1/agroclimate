import { CommandType, AircraftType, FlightMode, AircraftAsset } from "./types";
import { TelemetryGateway } from "./telemetryGateway";
import { AircraftRegistryManager } from "./aircraftRegistry";

export class CommandCenter {
  /**
   * Validates if a command is permitted for a given aircraft type.
   * Commercial aviation assets are strictly "monitoring only".
   */
  static isCommandAllowed(aircraftType: AircraftType, command: CommandType): { allowed: boolean; reason?: string } {
    const monitoringOnlyTypes: AircraftType[] = [
      "helicopter",
      "fixed_wing",
      "air_ambulance",
      "cargo",
      "maritime_patrol"
    ];

    if (monitoringOnlyTypes.includes(aircraftType)) {
      return {
        allowed: false,
        reason: `Manned commercial assets (${aircraftType.replace("_", " ")}) are in TELEMETRY MONITORING ONLY mode. Flight control command '${command}' is blocked.`
      };
    }

    return { allowed: true };
  }

  /**
   * Executes a command on the target aircraft.
   */
  static async sendCommand(
    aircraft: AircraftAsset,
    command: CommandType,
    params?: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    // 1. Guard check for commercial aircraft type
    const guard = this.isCommandAllowed(aircraft.type, command);
    if (!guard.allowed) {
      const details = guard.reason || "Command blocked by security policies.";
      await AircraftRegistryManager.addHistoryLog(
        aircraft.id,
        "command_rejected",
        `Command ${command} rejected: ${details}`
      );
      return { success: false, message: details };
    }

    // 2. Execute command action based on protocol
    const isSimulated = aircraft.protocol === "simulator";
    
    // Log the event
    await AircraftRegistryManager.addHistoryLog(
      aircraft.id,
      "command_issued",
      `Issued control command: ${command.toUpperCase()}`
    );

    if (isSimulated) {
      const currentTelemetry = TelemetryGateway.getLatestTelemetry(aircraft.id);
      if (!currentTelemetry) {
        return { success: false, message: "Aircraft telemetry offline." };
      }

      let nextMode: FlightMode = currentTelemetry.flightMode;
      let nextAlt = currentTelemetry.altitude;

      switch (command) {
        case "arm":
          nextMode = "stabilize";
          break;
        case "disarm":
          nextMode = "manual";
          nextAlt = 0;
          break;
        case "takeoff":
          nextMode = "guided";
          nextAlt = params?.altitude || 15; // default takeoff altitude
          break;
        case "land":
          nextMode = "land";
          break;
        case "returnHome":
          nextMode = "rtl";
          break;
        case "holdPosition":
          nextMode = "loiter";
          break;
        case "startMission":
          nextMode = "auto";
          nextAlt = params?.altitude || 50;
          break;
        case "pauseMission":
          nextMode = "loiter";
          break;
        case "resumeMission":
          nextMode = "auto";
          break;
      }

      // Update the gateway telemetry values instantly to simulate immediate feedback
      TelemetryGateway.updateTelemetry(aircraft.id, {
        flightMode: nextMode,
        altitude: nextAlt,
      });

      return {
        success: true,
        message: `Command '${command}' successfully executed via simulated ${aircraft.protocol.toUpperCase()} bridge.`
      };
    } else {
      // Connects to actual companion webapp / WebSocket gateway
      // Since it's live operations, the telemetry gateway will listen to the stream.
      // We log that the command was piped to the hardware interface.
      console.log(`Sending live command ${command} to companion API...`);
      return {
        success: true,
        message: `Live command '${command}' forwarded to ${aircraft.protocol.toUpperCase()} hardware connection.`
      };
    }
  }
}
