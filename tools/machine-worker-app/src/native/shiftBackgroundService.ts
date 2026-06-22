import { PermissionsAndroid, Platform } from "react-native";
import BackgroundService from "react-native-background-actions";

const TASK_NAME = "autoconnecto_shift_ble";
const TICK_MS = 12_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ShiftBackgroundTick = () => Promise<void>;

let backgroundTick: ShiftBackgroundTick | null = null;

/** Register work that must keep running during calls / app switch (runs inside the FG service loop). */
export function registerShiftBackgroundTick(fn: ShiftBackgroundTick | null) {
  backgroundTick = fn;
}

async function ensureNotificationPermission() {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  if (granted) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Headless loop — keeps Android/iOS process alive and runs BLE maintenance while backgrounded. */
async function shiftKeepAliveLoop() {
  await new Promise<void>(async (resolve) => {
    while (BackgroundService.isRunning()) {
      try {
        if (backgroundTick) await backgroundTick();
      } catch {
        /* tick is best-effort */
      }
      await sleep(TICK_MS);
    }
    resolve();
  });
}

export async function startShiftBackgroundService(machineLabel: string) {
  const label = machineLabel.trim() || "Machine";

  if (Platform.OS === "android") {
    await ensureNotificationPermission();
  }

  const options = {
    taskName: TASK_NAME,
    taskTitle: "Autoconnecto shift",
    taskDesc: label,
    taskIcon: { name: "ic_launcher", type: "mipmap" as const },
    color: "#0f172a",
    linkingURI: "autoconnecto-worker://shift",
    parameters: {},
    ...(Platform.OS === "android"
      ? { foregroundServiceType: ["connectedDevice"] as ("connectedDevice")[] }
      : {}),
  };

  if (BackgroundService.isRunning()) {
    await BackgroundService.updateNotification({ taskDesc: label });
    return;
  }

  await BackgroundService.start(shiftKeepAliveLoop, options);
}

export async function updateShiftBackgroundService(label: string) {
  if (!BackgroundService.isRunning()) return;
  await BackgroundService.updateNotification({ taskDesc: label.trim() || "Machine" });
}

export async function stopShiftBackgroundService() {
  registerShiftBackgroundTick(null);
  if (!BackgroundService.isRunning()) return;
  await BackgroundService.stop();
}
