import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  workerId: "@ac_worker/workerId",
  workerName: "@ac_worker/workerName",
  pinnedBleName: "@ac_worker/pinnedBleName",
  pinnedDeviceId: "@ac_worker/pinnedDeviceId",
  pinnedMachineLabel: "@ac_worker/pinnedMachineLabel",
} as const;

export type WorkerProfile = {
  workerId: string;
  workerName: string;
};

export type PinnedMachine = {
  bleAdvertName: string;
  /** Platform machine_code — shown to workers instead of AC-###. */
  machineLabel?: string;
  deviceId?: string;
};

export async function loadWorkerProfile(): Promise<WorkerProfile | null> {
  const [workerId, workerName] = await Promise.all([
    AsyncStorage.getItem(KEYS.workerId),
    AsyncStorage.getItem(KEYS.workerName),
  ]);
  const id = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  if (!id || !name) return null;
  return { workerId: id, workerName: name };
}

export async function saveWorkerProfile(profile: WorkerProfile) {
  await Promise.all([
    AsyncStorage.setItem(KEYS.workerId, profile.workerId.trim()),
    AsyncStorage.setItem(KEYS.workerName, profile.workerName.trim()),
  ]);
}

export async function clearWorkerProfile() {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.workerId),
    AsyncStorage.removeItem(KEYS.workerName),
  ]);
}

export async function loadPinnedMachine(): Promise<PinnedMachine | null> {
  const [bleAdvertName, deviceId, machineLabel] = await Promise.all([
    AsyncStorage.getItem(KEYS.pinnedBleName),
    AsyncStorage.getItem(KEYS.pinnedDeviceId),
    AsyncStorage.getItem(KEYS.pinnedMachineLabel),
  ]);
  const name = String(bleAdvertName || "").trim().toUpperCase();
  if (!name) return null;
  const label = String(machineLabel || "").trim();
  return {
    bleAdvertName: name,
    machineLabel: label || undefined,
    deviceId: deviceId ? String(deviceId) : undefined,
  };
}

export async function savePinnedMachine(pin: PinnedMachine) {
  const ops = [
    AsyncStorage.setItem(KEYS.pinnedBleName, pin.bleAdvertName.trim().toUpperCase()),
  ];
  if (pin.deviceId) {
    ops.push(AsyncStorage.setItem(KEYS.pinnedDeviceId, pin.deviceId));
  } else {
    ops.push(AsyncStorage.removeItem(KEYS.pinnedDeviceId));
  }
  const label = String(pin.machineLabel || "").trim();
  if (label) {
    ops.push(AsyncStorage.setItem(KEYS.pinnedMachineLabel, label));
  } else {
    ops.push(AsyncStorage.removeItem(KEYS.pinnedMachineLabel));
  }
  await Promise.all(ops);
}

/** Cleared only when the worker explicitly chooses another machine. */
export async function clearPinnedMachine() {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.pinnedBleName),
    AsyncStorage.removeItem(KEYS.pinnedDeviceId),
    AsyncStorage.removeItem(KEYS.pinnedMachineLabel),
  ]);
}
