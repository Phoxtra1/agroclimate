import {
  BarcodeScanBuffer, BrowserCameraAdapter, BrowserGeolocationAdapter,
  WebBluetoothPostHarvestAdapter, WebBluetoothSensorAdapter, WebHidScaleAdapter,
  WebSerialMavlinkAdapter, WebSerialSensorAdapter,
  type BleCharacteristicMapping, type PostHarvestStationReading,
  type SerialAdapterOptions,
} from "./browserAdapters";
import { DeviceIntegrationRuntime, ResilientObservationDelivery } from "./deviceRuntime";
import {
  createPostHarvestStationSink, createSupabaseDeviceObservationSink,
} from "./supabaseGateway";

export interface AgroClimateHardwareRuntimeOptions {
  /** Must resolve secrets from Amineva's protected device-credential store. */
  resolveDeviceToken: (deviceId: string) => Promise<string | null>;
  bleMappings?: readonly BleCharacteristicMapping[];
  serialOptions?: SerialAdapterOptions;
  decodeHidScaleReport?: (data: DataView) => number | null;
  hidScaleUnit?: string;
  mavlinkBaudRate?: number;
  postHarvest?: {
    serviceUuid: string;
    characteristicUuid: string;
    decodeReading: (value: DataView) => PostHarvestStationReading | null;
  };
}

/** Creates and registers the supported browser adapters against the real Supabase delivery services. */
export function createAgroClimateHardwareRuntime(options: AgroClimateHardwareRuntimeOptions): DeviceIntegrationRuntime {
  const delivery = new ResilientObservationDelivery(createSupabaseDeviceObservationSink(options.resolveDeviceToken));
  const runtime = new DeviceIntegrationRuntime(delivery);
  const context = { onObservation: (item: Parameters<DeviceIntegrationRuntime["acceptObservation"]>[0]) => runtime.acceptObservation(item) };

  runtime.registerAdapter(new BrowserGeolocationAdapter(context));
  runtime.registerAdapter(new BrowserCameraAdapter());

  if (options.bleMappings?.length) {
    runtime.registerAdapter(new WebBluetoothSensorAdapter(context, options.bleMappings));
  }
  if (options.serialOptions) {
    runtime.registerAdapter(new WebSerialSensorAdapter(context, options.serialOptions));
  }
  if (options.decodeHidScaleReport) {
    runtime.registerAdapter(new WebHidScaleAdapter(context, options.decodeHidScaleReport, options.hidScaleUnit ?? "kg"));
  }
  runtime.registerAdapter(new WebSerialMavlinkAdapter(context, options.mavlinkBaudRate ?? 57600));

  if (options.postHarvest) {
    runtime.registerAdapter(new WebBluetoothPostHarvestAdapter(
      options.postHarvest.serviceUuid,
      options.postHarvest.characteristicUuid,
      options.postHarvest.decodeReading,
      createPostHarvestStationSink(options.resolveDeviceToken),
    ));
  }

  return runtime;
}

/** Use the returned buffer from the Agro Inventory scan field to route barcode text into the existing item lookup workflow. */
export function createAgroInventoryBarcodeScanner(onBarcode: (barcode: string) => void): BarcodeScanBuffer {
  return new BarcodeScanBuffer(onBarcode);
}
