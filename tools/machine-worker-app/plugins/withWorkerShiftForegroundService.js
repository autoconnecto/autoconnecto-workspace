const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");

const ANDROIDX_CORE = "androidx.core:core:1.15.0";

function patchGradleDependencies(contents) {
  if (contents.includes(ANDROIDX_CORE)) return contents;
  return contents.replace(
    /dependencies\s*\{/,
    `dependencies {
    implementation '${ANDROIDX_CORE}'`
  );
}

function withBackgroundActionsAndroidX(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const buildGradle = path.join(
        cfg.modRequest.projectRoot,
        "node_modules/react-native-background-actions/android/build.gradle"
      );
      if (!fs.existsSync(buildGradle)) return cfg;

      const contents = fs.readFileSync(buildGradle, "utf8");
      const next = patchGradleDependencies(contents);
      if (next !== contents) {
        fs.writeFileSync(buildGradle, next);
      }
      return cfg;
    },
  ]);
}

/**
 * Android 12+ requires a foreground service (connectedDevice) to keep BLE alive
 * while the worker takes calls or switches apps mid-shift.
 */
function withWorkerShiftForegroundService(config) {
  config = withAndroidManifest(config, (cfg) => {
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

  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchGradleDependencies(cfg.modResults.contents);
    return cfg;
  });

  config = withBackgroundActionsAndroidX(config);
  return config;
}

module.exports = withWorkerShiftForegroundService;
