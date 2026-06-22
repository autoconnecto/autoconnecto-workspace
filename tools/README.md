# Autoconnecto tools

Developer and factory-floor utilities in this repo. **Operators do not configure anything here** — admins download the Worker APK from the platform header (**Worker app**) or the paths below.

## Worker app (Android, BLE)

| Item | Location |
|------|----------|
| **Latest APK (repo copy)** | [`machine-worker-app/autoconnecto-worker.apk`](machine-worker-app/autoconnecto-worker.apk) |
| Versioned APK | [`machine-worker-app/autoconnecto-worker-v1.2.8.apk`](machine-worker-app/autoconnecto-worker-v1.2.8.apk) |
| Source | [`machine-worker-app/`](machine-worker-app/) |
| Contract | [`sdk/MACHINE_RUNTIME_BLE.md`](../sdk/MACHINE_RUNTIME_BLE.md) |

**Platform UI:** logged-in dashboard → top bar → **Worker app** (next to Android app).

**GitHub release (after tag `worker-v1.2.7`):**  
https://github.com/autoconnecto/autoconnecto-workspace/releases/latest/download/autoconnecto-worker.apk

### Ship a new Worker APK

```bash
# 1. Bump version in tools/machine-worker-app/package.json + app.json
# 2. Commit, push, tag:
git tag worker-v1.2.7
git push origin worker-v1.2.7
# 3. CI builds APK → GitHub Release
# 4. Optional: copy release APK into machine-worker-app/ for repo convenience
```

### Local build

```bash
cd tools/machine-worker-app
npm ci
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../autoconnecto-worker.apk
```

## Machine runtime firmware (BLE + WiFi split)

| Item | Path |
|------|------|
| BLE bridge | [`machine-runtime-ble/esp_ble/esp_ble.ino`](machine-runtime-ble/esp_ble/esp_ble.ino) |
| WiFi / MQTT / PZEM | [`machine-runtime-ble/esp_wifi/esp_wifi.ino`](machine-runtime-ble/esp_wifi/esp_wifi.ino) |
| Docs | [`machine-runtime-ble/README.md`](machine-runtime-ble/README.md) |

## Other tools

| Tool | Path |
|------|------|
| 10-machine MQTT sim | [`machine-fleet-sim-10/`](machine-fleet-sim-10/) |
| NFC runtime (pilot) | [`machine-runtime-nfc/`](machine-runtime-nfc/) |

## After firmware + app update (bench checklist)

1. Flash **esp_wifi** and **esp_ble** (you did this).
2. Install **Worker app v1.2.7** on the phone.
3. Dashboard → Machine Fleet **Setup** → save tool life limit again (pushes SHARED attrs to ESP).
4. Worker app → pick **AC-###** → START SESSION → **Tool life left** should match limit and decrement on **+**.
