import { Alert, Linking, Platform } from "react-native";
import { getBleManager } from "./workerBle";

const BT_WAIT_MS = 120_000;

function openBluetoothSettings() {
  if (Platform.OS === "android") {
    return Linking.openURL(
      "intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end"
    ).catch(() => Linking.openSettings());
  }
  return Linking.openSettings();
}

async function promptTurnBluetoothOn(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Turn on Bluetooth",
      "Autoconnecto Worker needs Bluetooth to find and connect to your machine (AC-001, etc.).",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Open Bluetooth settings",
          onPress: () => {
            void openBluetoothSettings();
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
}

/** Request permissions and ensure the phone Bluetooth radio is on. */
export async function ensureBluetoothPoweredOn(): Promise<void> {
  const ble = getBleManager();
  let state = await ble.state();

  if (state === "PoweredOn") return;

  if (state === "PoweredOff") {
    await promptTurnBluetoothOn();
  } else if (state === "Unauthorized") {
    throw new Error(
      "Bluetooth permission denied. Open Settings → Apps → Autoconnecto Worker → Permissions."
    );
  } else if (state === "Unsupported") {
    throw new Error("Bluetooth is not supported on this device.");
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sub.remove();
      reject(
        new Error("Bluetooth is still off. Turn it on in Settings, then return to the app.")
      );
    }, BT_WAIT_MS);

    const sub = ble.onStateChange((next) => {
      if (next === "PoweredOn") {
        clearTimeout(timeout);
        sub.remove();
        resolve();
        return;
      }
      if (next === "Unauthorized" || next === "Unsupported") {
        clearTimeout(timeout);
        sub.remove();
        reject(new Error(`Bluetooth unavailable (${next}).`));
      }
    }, true);
  });
}
