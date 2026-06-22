import { Platform } from "react-native";
import BackgroundService from "react-native-background-actions";

const TASK_NAME = "autoconnecto_shift_ble";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Headless loop — keeps the Android process alive for the BLE GATT link. */
async function shiftKeepAliveLoop() {
  await new Promise<void>(async (resolve) => {
    while (BackgroundService.isRunning()) {
      await sleep(5000);
    }
    resolve();
  });
}

export async function startShiftBackgroundService(machineLabel: string) {
  const label = machineLabel.trim() || "Machine";
  if (Platform.OS === "ios") {
    // iOS: UIBackgroundModes bluetooth-central (app.json) + beginBackgroundTask in the library.
    if (BackgroundService.isRunning()) {
      await BackgroundService.updateNotification({ taskDesc: label });
      return;
    }
    await BackgroundService.start(shiftKeepAliveLoop, {
      taskName: TASK_NAME,
      taskTitle: "Autoconnecto shift",
      taskDesc: label,
      taskIcon: { name: "ic_launcher", type: "mipmap" },
      color: "#0f172a",
      linkingURI: "autoconnecto-worker://shift",
      parameters: {},
    });
    return;
  }

  if (Platform.OS !== "android") return;

  if (BackgroundService.isRunning()) {
    await BackgroundService.updateNotification({ taskDesc: label });
    return;
  }

  await BackgroundService.start(shiftKeepAliveLoop, {
    taskName: TASK_NAME,
    taskTitle: "Autoconnecto shift",
    taskDesc: label,
    taskIcon: { name: "ic_launcher", type: "mipmap" },
    color: "#0f172a",
    linkingURI: "autoconnecto-worker://shift",
    parameters: {},
    foregroundServiceType: ["connectedDevice"],
  });
}

export async function stopShiftBackgroundService() {
  if (!BackgroundService.isRunning()) return;
  await BackgroundService.stop();
}
