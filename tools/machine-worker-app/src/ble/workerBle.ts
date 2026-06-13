import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  ScanMode,
  type Characteristic,
  type Device,
} from "react-native-ble-plx";
import {
  BLE_CMD_CHAR_UUID,
  BLE_SCAN_EXTENDED_MS,
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

/** Recover from a wedged BLE stack without reinstalling the app. */
export async function resetBleManager() {
  const ble = manager;
  manager = null;
  if (!ble) return;
  try {
    await ble.stopDeviceScan();
  } catch {
    /* ignore */
  }
  try {
    const connected = await ble.connectedDevices([BLE_SERVICE_UUID]);
    await Promise.all(connected.map((d) => d.cancelConnection().catch(() => {})));
  } catch {
    /* ignore */
  }
  try {
    await ble.destroy();
  } catch {
    /* ignore */
  }
  await sleep(500);
}

export function normalizeBleName(name: string | null | undefined) {
  return String(name || "").trim().toUpperCase();
}

export function isMachineAdvertName(name: string | null | undefined) {
  return MACHINE_BLE_NAME_RE.test(normalizeBleName(name));
}

function uuidCompact(uuid: string) {
  return uuid.toLowerCase().replace(/-/g, "");
}

export function deviceAdvertisesWorkerService(device: Device) {
  const target = uuidCompact(BLE_SERVICE_UUID);
  return (device.serviceUUIDs ?? []).some((uuid) => uuidCompact(uuid) === target);
}

/** Best-effort BLE advert name from scan result (name may arrive in a later duplicate). */
export function machineBleNameFromDevice(device: Device): string | null {
  const direct = normalizeBleName(device.localName || device.name);
  if (isMachineAdvertName(direct)) return direct;
  return null;
}

export function bleAdvertNameFromSlot(slot: number | null | undefined): string | null {
  if (slot === null || slot === undefined || !Number.isFinite(Number(slot))) return null;
  const n = Math.max(0, Math.floor(Number(slot)));
  const name = `AC-${String(n).padStart(3, "0")}`;
  return isMachineAdvertName(name) ? name : null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Map native BLE errors to operator-friendly text. */
export function friendlyBleError(err: unknown, fallback = "Bluetooth error"): string {
  const msg = err instanceof Error ? err.message : String(err || fallback);
  if (/cancel/i.test(msg)) {
    return "Bluetooth was busy. Wait a second, then tap Scan again.";
  }
  if (/timeout/i.test(msg)) {
    return "Could not reach the machine in time. Move closer and try again.";
  }
  if (/permission|unauthorized/i.test(msg)) {
    return msg;
  }
  return msg || fallback;
}

/** Stop scans and drop stale GATT links so Android can discover peripherals again. */
export async function prepareBleForScan() {
  await requestBlePermissions();
  const ble = getBleManager();
  try {
    await ble.stopDeviceScan();
  } catch {
    /* no active scan */
  }
  try {
    const connected = await ble.connectedDevices([BLE_SERVICE_UUID]);
    await Promise.all(
      connected.map(async (device) => {
        try {
          await device.cancelConnection();
        } catch {
          /* ignore */
        }
      })
    );
  } catch {
    /* ignore */
  }
  await sleep(400);
}

async function requestAndroidBlePermissions() {
  if (Platform.OS !== "android") return;

  const api = typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);

  if (api >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN!,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
    ]);
    const scan = result["android.permission.BLUETOOTH_SCAN"];
    const connect = result["android.permission.BLUETOOTH_CONNECT"];
    if (
      scan !== PermissionsAndroid.RESULTS.GRANTED ||
      connect !== PermissionsAndroid.RESULTS.GRANTED
    ) {
      throw new Error(
        "Bluetooth permissions required. Open Settings → Apps → Autoconnecto Worker → Permissions and allow Nearby devices + Location."
      );
    }
    return;
  }

  const location = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
    {
      title: "Location for Bluetooth scan",
      message:
        "Android needs location permission to discover nearby machines (AC-001, etc.) over Bluetooth.",
      buttonPositive: "Allow",
    }
  );
  if (location !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Location permission is required to scan for machines over Bluetooth.");
  }
}

export async function requestBlePermissions() {
  await requestAndroidBlePermissions();

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
        reject(
          new Error(
            `Bluetooth unavailable (${next}). Turn Bluetooth on in phone settings.`
          )
        );
      }
    }, true);
  });
}

async function resolveMachineViaConnect(
  deviceId: string,
  rssi: number | null
): Promise<ScannedMachine | null> {
  try {
    const ble = getBleManager();
    const device = await ble.connectToDevice(deviceId, { timeout: 10000 });
    const linked = await connectDevice(device);
    const status = await readBleStatus(linked);
    await linked.cancelConnection();
    const bleAdvertName = bleAdvertNameFromSlot(status?.slot ?? null);
    if (!bleAdvertName) return null;
    return { deviceId, bleAdvertName, rssi };
  } catch {
    return null;
  }
}

export type ScanNearbyResult = {
  machines: ScannedMachine[];
  /** Our GATT service seen in scan but advert name missing (Android quirk). */
  serviceHits: number;
};

export type ScanProgress = ScanNearbyResult & {
  phase: "scanning" | "resolving" | "done";
};

export type ScanNearbyOptions = {
  timeoutMs?: number;
  extendedMs?: number;
  resetManager?: boolean;
  onProgress?: (progress: ScanProgress) => void;
};

export async function scanNearbyMachines(
  timeoutMs = BLE_SCAN_TIMEOUT_MS
): Promise<ScannedMachine[]> {
  const result = await scanNearbyMachinesDetailed({ timeoutMs });
  return result.machines;
}

function publishScanProgress(
  onProgress: ScanNearbyOptions["onProgress"],
  phase: ScanProgress["phase"],
  machines: ScannedMachine[],
  serviceHits: number
) {
  onProgress?.({
    phase,
    machines: [...machines].sort((a, b) => a.bleAdvertName.localeCompare(b.bleAdvertName)),
    serviceHits,
  });
}

export async function scanNearbyMachinesDetailed(
  options: ScanNearbyOptions = {}
): Promise<ScanNearbyResult> {
  const timeoutMs = options.timeoutMs ?? BLE_SCAN_TIMEOUT_MS;
  const extendedMs = options.extendedMs ?? BLE_SCAN_EXTENDED_MS;
  const onProgress = options.onProgress;

  if (options.resetManager) {
    await resetBleManager();
  }

  await prepareBleForScan();
  const ble = getBleManager();
  const named = new Map<string, ScannedMachine>();
  const pendingById = new Map<string, ScannedMachine>();
  let scanError: Error | null = null;

  const ingestDevice = (device: Device) => {
    const bleAdvertName = machineBleNameFromDevice(device);
    const hasService = deviceAdvertisesWorkerService(device);
    const rssi = device.rssi ?? null;

    if (bleAdvertName && isMachineAdvertName(bleAdvertName)) {
      pendingById.delete(device.id);
      const prev = named.get(bleAdvertName);
      if (!prev || (rssi !== null && (prev.rssi === null || rssi > prev.rssi))) {
        named.set(bleAdvertName, { deviceId: device.id, bleAdvertName, rssi });
        publishScanProgress(onProgress, "scanning", Array.from(named.values()), pendingById.size);
      }
      return;
    }

    if (hasService) {
      const prev = pendingById.get(device.id);
      if (!prev) {
        pendingById.set(device.id, { deviceId: device.id, bleAdvertName: "", rssi });
      } else if (rssi !== null && (prev.rssi === null || rssi > prev.rssi)) {
        pendingById.set(device.id, { ...prev, rssi });
      }
      publishScanProgress(onProgress, "scanning", Array.from(named.values()), pendingById.size);
    }
  };

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ble.stopDeviceScan().catch(() => {});
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);

    const onDevice = (error: Error | null, device: Device | null) => {
      if (error) {
        scanError = error;
        clearTimeout(timer);
        finish();
        return;
      }
      if (!device) return;
      ingestDevice(device);
    };

    ble.startDeviceScan(
      [BLE_SERVICE_UUID],
      { allowDuplicates: true, scanMode: ScanMode.LowLatency },
      onDevice
    );
  });

  if (scanError) {
    throw scanError;
  }

  const scanServiceFilter = [BLE_SERVICE_UUID];

  let machines = Array.from(named.values());

  if (!machines.length) {
    publishScanProgress(onProgress, "scanning", machines, pendingById.size);
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        ble.stopDeviceScan().catch(() => {});
        resolve();
      };
      const timer = setTimeout(finish, extendedMs);
      ble.startDeviceScan(
        scanServiceFilter,
        { allowDuplicates: true, scanMode: ScanMode.LowLatency },
        (error, device) => {
          if (error) {
            scanError = error;
            clearTimeout(timer);
            finish();
            return;
          }
          if (device) ingestDevice(device);
        }
      );
    });
    machines = Array.from(named.values());
  }

  if (scanError) {
    throw scanError;
  }

  let serviceHits = pendingById.size;

  if (!machines.length && pendingById.size > 0) {
    publishScanProgress(onProgress, "resolving", machines, serviceHits);
    for (const pending of pendingById.values()) {
      const resolved = await resolveMachineViaConnect(pending.deviceId, pending.rssi);
      if (resolved) {
        machines.push(resolved);
        publishScanProgress(onProgress, "resolving", machines, serviceHits);
      }
    }
  }

  machines = machines.sort((a, b) => a.bleAdvertName.localeCompare(b.bleAdvertName));
  publishScanProgress(onProgress, "done", machines, serviceHits);
  return { machines, serviceHits };
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

  await prepareBleForScan();
  const ble = getBleManager();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ble.stopDeviceScan();
      reject(new Error(`Could not find ${target}. Move closer to the machine.`));
    }, BLE_SCAN_TIMEOUT_MS);

    ble.startDeviceScan([BLE_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
      if (settled) return;
      if (error) {
        settled = true;
        clearTimeout(timer);
        ble.stopDeviceScan();
        reject(error);
        return;
      }
      const seen = device ? machineBleNameFromDevice(device) : null;
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
