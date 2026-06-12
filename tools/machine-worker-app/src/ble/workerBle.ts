import { BleManager, type Characteristic, type Device } from "react-native-ble-plx";
import {
  BLE_CMD_CHAR_UUID,
  BLE_SCAN_TIMEOUT_MS,
  BLE_SERVICE_UUID,
  BLE_STATUS_CHAR_UUID,
  MACHINE_BLE_NAME_RE,
} from "../config/constants";
import { base64ToUtf8, utf8ToBase64 } from "./encoding";

export type BleMachineStatus = {
  slot?: number;
  session?: boolean;
  jobs?: number;
  allow_run?: boolean;
  operator_id?: string;
  operator_name?: string;
  ble_linked?: boolean;
  session_busy?: boolean;
};

export type BleCommand =
  | { cmd: "start"; operator_id: string; operator_name: string }
  | { cmd: "stop" }
  | { cmd: "job_add" }
  | { cmd: "job_remove" }
  | { cmd: "heartbeat" };

export type ScannedMachine = {
  deviceId: string;
  bleAdvertName: string;
  rssi: number | null;
};

let manager: BleManager | null = null;

export function getBleManager() {
  if (!manager) manager = new BleManager();
  return manager;
}

export function normalizeBleName(name: string | null | undefined) {
  return String(name || "").trim().toUpperCase();
}

export function isMachineAdvertName(name: string | null | undefined) {
  return MACHINE_BLE_NAME_RE.test(normalizeBleName(name));
}

export async function requestBlePermissions() {
  const ble = getBleManager();
  const state = await ble.state();
  if (state === "PoweredOn") return;
  await new Promise<void>((resolve, reject) => {
    const sub = ble.onStateChange((next) => {
      if (next === "PoweredOn") {
        sub.remove();
        resolve();
      } else if (next === "Unauthorized" || next === "Unsupported") {
        sub.remove();
        reject(new Error(`Bluetooth unavailable (${next})`));
      }
    }, true);
  });
}

export async function scanNearbyMachines(timeoutMs = BLE_SCAN_TIMEOUT_MS): Promise<ScannedMachine[]> {
  await requestBlePermissions();
  const ble = getBleManager();
  const found = new Map<string, ScannedMachine>();

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      ble.stopDeviceScan();
      resolve();
    }, timeoutMs);

    ble.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error || !device) return;
      const bleAdvertName = normalizeBleName(device.localName || device.name);
      if (!isMachineAdvertName(bleAdvertName)) return;
      const prev = found.get(bleAdvertName);
      const rssi = device.rssi ?? null;
      if (!prev || (rssi !== null && (prev.rssi === null || rssi > prev.rssi))) {
        found.set(bleAdvertName, { deviceId: device.id, bleAdvertName, rssi });
      }
    });
  });

  return Array.from(found.values()).sort((a, b) => a.bleAdvertName.localeCompare(b.bleAdvertName));
}

async function connectDevice(device: Device): Promise<Device> {
  const connected = await device.connect({ timeout: 12000 });
  await connected.discoverAllServicesAndCharacteristics();
  return connected;
}

export async function connectByDeviceId(deviceId: string): Promise<Device> {
  await requestBlePermissions();
  const ble = getBleManager();
  const device = await ble.connectToDevice(deviceId, { timeout: 12000 });
  return connectDevice(device);
}

export async function scanAndConnect(bleAdvertName: string): Promise<Device> {
  const target = normalizeBleName(bleAdvertName);
  if (!target) throw new Error("Invalid machine BLE name.");

  await requestBlePermissions();
  const ble = getBleManager();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ble.stopDeviceScan();
      reject(new Error(`Could not find ${target}. Move closer to the machine.`));
    }, BLE_SCAN_TIMEOUT_MS);

    ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (settled) return;
      if (error) {
        settled = true;
        clearTimeout(timer);
        ble.stopDeviceScan();
        reject(error);
        return;
      }
      const seen = normalizeBleName(device?.localName || device?.name);
      if (!device || seen !== target) return;

      settled = true;
      clearTimeout(timer);
      ble.stopDeviceScan();
      connectDevice(device).then(resolve).catch(reject);
    });
  });
}

export async function connectPinnedMachine(pin: {
  bleAdvertName: string;
  deviceId?: string;
}): Promise<Device> {
  if (pin.deviceId) {
    try {
      return await connectByDeviceId(pin.deviceId);
    } catch {
      /* fall through to name scan */
    }
  }
  return scanAndConnect(pin.bleAdvertName);
}

export async function writeBleCommand(device: Device, command: BleCommand) {
  const payload = utf8ToBase64(JSON.stringify(command));
  await device.writeCharacteristicWithResponseForService(
    BLE_SERVICE_UUID,
    BLE_CMD_CHAR_UUID,
    payload
  );
}

export function parseStatusCharacteristic(char: Characteristic | null): BleMachineStatus | null {
  if (!char?.value) return null;
  try {
    return JSON.parse(base64ToUtf8(char.value)) as BleMachineStatus;
  } catch {
    return null;
  }
}

export function monitorBleStatus(
  device: Device,
  onStatus: (status: BleMachineStatus) => void
) {
  return device.monitorCharacteristicForService(
    BLE_SERVICE_UUID,
    BLE_STATUS_CHAR_UUID,
    (error, char) => {
      if (error) return;
      const parsed = parseStatusCharacteristic(char);
      if (parsed) onStatus(parsed);
    }
  );
}

export async function readBleStatus(device: Device): Promise<BleMachineStatus | null> {
  const char = await device.readCharacteristicForService(
    BLE_SERVICE_UUID,
    BLE_STATUS_CHAR_UUID
  );
  return parseStatusCharacteristic(char);
}

export async function disconnectBle(device: Device | null) {
  if (!device) return;
  try {
    const connected = await device.isConnected();
    if (connected) await device.cancelConnection();
  } catch {
    /* ignore */
  }
}

export function isSessionOwnedByWorker(
  status: BleMachineStatus | null,
  workerId: string
): boolean {
  if (!status?.session) return false;
  const op = String(status.operator_id || "").trim();
  return !op || op === workerId.trim();
}

export function isMachineBusyForWorker(
  status: BleMachineStatus | null,
  workerId: string
): boolean {
  if (!status?.session) return false;
  if (status.session_busy) return true;
  const op = String(status.operator_id || "").trim();
  return Boolean(op && op !== workerId.trim());
}
