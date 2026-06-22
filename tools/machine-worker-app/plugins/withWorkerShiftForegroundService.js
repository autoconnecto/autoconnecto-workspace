const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Android 12+ requires a foreground service (connectedDevice) to keep BLE alive
 * while the worker takes calls or switches apps mid-shift.
 */
function withWorkerShiftForegroundService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    AndroidConfig.Permissions.ensurePermissions(manifest, [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.WAKE_LOCK",
    ]);

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (!Array.isArray(app.service)) {
      app.service = [];
    }

    const names = new Set([
      "com.asterinet.react.bgactions.RNBackgroundActionsTask",
      ".RNBackgroundActionsTask",
    ]);

    let service = app.service.find((row) => names.has(row?.$?.["android:name"]));
    if (!service) {
      service = {
        $: {
          "android:name": "com.asterinet.react.bgactions.RNBackgroundActionsTask",
        },
      };
      app.service.push(service);
    }

    service.$["android:foregroundServiceType"] = "connectedDevice";
    service.$["android:exported"] = "false";

    return cfg;
  });
}

module.exports = withWorkerShiftForegroundService;
