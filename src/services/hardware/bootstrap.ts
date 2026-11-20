import {
  BarcodeScanBuffer, BrowserCameraAdapter, BrowserGeolocationAdapter,
  WebBluetoothPostHarvestAdapter, WebBluetoothSensorAdapter, WebHidScaleAdapter,
  WebSerialMavlinkAdapter, WebSerialSensorAdapter, STANDARD_BLE_SENSOR_MAPPINGS, decodeNmea0183Line,
  type BleCharacteristicMapping, type PostHarvestStationReading, type SerialAdapterOptions,
} from "./browserAdapters";
import { DeviceIntegrationRuntime, ResilientObservationDelivery } from "./deviceRuntime";
import { createPostHarvestStationSink, createSupabaseDeviceObservationSink } from "./supabaseGateway";

export interface AgroClimateHardwareRuntimeOptions {
  /** Must resolve secrets from Amineva protected device-credential storage. */
  resolveDeviceToken: (deviceId: string) => Promise<string | null>;
  bleMappings?: readonly BleCharacteristicMapping[];
  serialOptions?: SerialAdapterOptions;
  decodeHidScaleReport?: (data: DataView) => number | null;
  hidScaleUnit?: string;
  mavlinkBaudRate?: number;
  agtransNmeaBaudRate?: number;
  aircraftType?: import("@/services/aih/types").AircraftType;
  postHarvest?: { serviceUuid: string; characteristicUuid: string; decodeReading: (value: DataView) => PostHarvestStationReading | null };
}

/** Creates and registers browser adapters against the real Supabase delivery services. */
export function createAgroClimateHardwareRuntime(options: AgroClimateHardwareRuntimeOptions): DeviceIntegrationRuntime {
  const delivery = new ResilientObservationDelivery(createSupabaseDeviceObservationSink(options.resolveDeviceToken));
  const runtime = new DeviceIntegrationRuntime(delivery);
  const context = { onObservation: (item: Parameters<DeviceIntegrationRuntime["acceptObservation"]>[0]) => runtime.acceptObservation(item) };
  runtime.registerAdapter(new BrowserGeolocationAdapter(context));
  runtime.registerAdapter(new BrowserCameraAdapter());
  const bleMappings = [...STANDARD_BLE_SENSOR_MAPPINGS, ...(options.bleMappings ?? [])];
  if (bleMappings.length) runtime.registerAdapter(new WebBluetoothSensorAdapter(context, bleMappings));
  runtime.registerAdapter(new WebSerialSensorAdapter(context, {
    adapterId: "agtrans-nmea0183-serial-v1", components: ["agtrans"],
    baudRate: options.agtransNmeaBaudRate ?? 4800, decodeLine: decodeNmea0183Line,
  }));
  if (options.serialOptions) runtime.registerAdapter(new WebSerialSensorAdapter(context, options.serialOptions));
  if (options.decodeHidScaleReport) runtime.registerAdapter(new WebHidScaleAdapter(context, options.decodeHidScaleReport, options.hidScaleUnit ?? "kg"));
  runtime.registerAdapter(new WebSerialMavlinkAdapter(context, options.mavlinkBaudRate ?? 57600, options.aircraftType ?? "drone"));
  if (options.postHarvest) runtime.registerAdapter(new WebBluetoothPostHarvestAdapter(options.postHarvest.serviceUuid, options.postHarvest.characteristicUuid, options.postHarvest.decodeReading, createPostHarvestStationSink(options.resolveDeviceToken)));
  return runtime;
}

/** Route decoded scanner text into the existing Agro Inventory item lookup workflow. */
export function createAgroInventoryBarcodeScanner(onBarcode: (barcode: string) => void): BarcodeScanBuffer {
  return new BarcodeScanBuffer(onBarcode);
}