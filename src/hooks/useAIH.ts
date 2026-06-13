import { useState, useEffect, useCallback } from "react";
import { AirIntegrationHub } from "@/services/aih/aihService";
import { TelemetryGateway } from "@/services/aih/telemetryGateway";
import { AircraftRegistryManager, FlightHistoryItem } from "@/services/aih/aircraftRegistry";
import {
  AircraftAsset,
  UniversalTelemetry,
  CommandType,
  CameraSensorSource,
  StreamProtocol,
  StreamHealth
} from "@/services/aih/types";

export function useAIH() {
  const [hubState, setHubState] = useState(AirIntegrationHub.getState());
  const [telemetry, setTelemetry] = useState<UniversalTelemetry | null>(null);
  const [streamHealth, setStreamHealth] = useState<StreamHealth>(AirIntegrationHub.getStreamHealth());
  const [aircrafts, setAircrafts] = useState<AircraftAsset[]>([]);
  const [flightHistory, setFlightHistory] = useState<FlightHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync core hub state
  useEffect(() => {
    return AirIntegrationHub.addListener((newState) => {
      setHubState(newState);
    });
  }, []);

  // Fetch aircraft registry
  const refreshAircrafts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await AircraftRegistryManager.getAircrafts();
      setAircrafts(list);
    } catch (err) {
      console.error("Failed to fetch aircrafts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch history logs
  const refreshHistory = useCallback(async (aircraftId?: string) => {
    try {
      const logs = await AircraftRegistryManager.getFlightHistory(aircraftId);
      setFlightHistory(logs);
    } catch (err) {
      console.error("Failed to fetch history logs:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAircrafts();
    refreshHistory();
  }, [refreshAircrafts, refreshHistory]);

  // Subscribe to telemetry when an aircraft is connected
  useEffect(() => {
    if (!hubState.activeAircraft) {
      setTelemetry(null);
      return;
    }

    const unsub = TelemetryGateway.subscribe(hubState.activeAircraft.id, (t) => {
      setTelemetry(t);
    });

    return () => {
      unsub();
    };
  }, [hubState.activeAircraft]);

  // Stream health poll loop
  useEffect(() => {
    const t = setInterval(() => {
      setStreamHealth(AirIntegrationHub.getStreamHealth());
    }, 1000);
    return () => clearInterval(t);
  }, [hubState.activeAircraft, hubState.isSimulator]);

  // Actions
  const connect = useCallback(async (aircraftId: string) => {
    await AirIntegrationHub.connect(aircraftId);
    await refreshAircrafts();
    await refreshHistory(aircraftId);
  }, [refreshAircrafts, refreshHistory]);

  const disconnect = useCallback(async () => {
    const id = hubState.activeAircraft?.id;
    await AirIntegrationHub.disconnect();
    await refreshAircrafts();
    if (id) await refreshHistory(id);
  }, [hubState.activeAircraft, refreshAircrafts, refreshHistory]);

  const issueCommand = useCallback(async (command: CommandType, params?: Record<string, any>) => {
    const res = await AirIntegrationHub.issueCommand(command, params);
    if (hubState.activeAircraft) {
      await refreshHistory(hubState.activeAircraft.id);
    }
    return res;
  }, [hubState.activeAircraft, refreshHistory]);

  const changeSensor = useCallback((sensor: CameraSensorSource) => {
    AirIntegrationHub.changeSensor(sensor);
  }, []);

  const changeCameraProtocol = useCallback((protocol: StreamProtocol) => {
    AirIntegrationHub.changeCameraProtocol(protocol);
  }, []);

  const toggleSimulatorMode = useCallback((on: boolean) => {
    AirIntegrationHub.toggleSimulatorMode(on);
  }, []);

  const registerAircraft = useCallback(async (
    aircraft: Omit<AircraftAsset, "id" | "status" | "lastConnected">
  ) => {
    const res = await AircraftRegistryManager.registerAircraft(aircraft);
    await refreshAircrafts();
    return res;
  }, [refreshAircrafts]);

  const updateAircraft = useCallback(async (id: string, updates: Partial<AircraftAsset>) => {
    const res = await AircraftRegistryManager.updateAircraft(id, updates);
    await refreshAircrafts();
    return res;
  }, [refreshAircrafts]);

  const removeAircraft = useCallback(async (id: string) => {
    await AircraftRegistryManager.removeAircraft(id);
    await refreshAircrafts();
  }, [refreshAircrafts]);

  return {
    ...hubState,
    telemetry,
    streamHealth,
    aircrafts,
    flightHistory,
    loading,
    connect,
    disconnect,
    issueCommand,
    changeSensor,
    changeCameraProtocol,
    toggleSimulatorMode,
    refreshAircrafts,
    registerAircraft,
    updateAircraft,
    removeAircraft,
    refreshHistory,
  };
}
export type UseAIH = ReturnType<typeof useAIH>;
