import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  workerId: "@ac_worker/workerId",
  workerName: "@ac_worker/workerName",
  pinnedBleName: "@ac_worker/pinnedBleName",
  pinnedDeviceId: "@ac_worker/pinnedDeviceId",
} as const;

export type WorkerProfile = {
  workerId: string;
  workerName: string;
};

export type PinnedMachine = {
  bleAdvertName: string;
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
  const [bleAdvertName, deviceId] = await Promise.all([
    AsyncStorage.getItem(KEYS.pinnedBleName),
    AsyncStorage.getItem(KEYS.pinnedDeviceId),
  ]);
  const name = String(bleAdvertName || "").trim().toUpperCase();
  if (!name) return null;
  return {
    bleAdvertName: name,
    deviceId: deviceId ? String(deviceId) : undefined,
  };
}

export async function savePinnedMachine(pin: PinnedMachine) {
  const ops = [AsyncStorage.setItem(KEYS.pinnedBleName, pin.bleAdvertName.trim().toUpperCase())];
  if (pin.deviceId) {
    ops.push(AsyncStorage.setItem(KEYS.pinnedDeviceId, pin.deviceId));
  } else {
    ops.push(AsyncStorage.removeItem(KEYS.pinnedDeviceId));
  }
  await Promise.all(ops);
}

/** Cleared only when the worker explicitly chooses another machine. */
export async function clearPinnedMachine() {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.pinnedBleName),
    AsyncStorage.removeItem(KEYS.pinnedDeviceId),
  ]);
}
