# Autoconnecto Worker (Android, BLE-only)

Operator app for machine sessions. **No cloud login** — phone talks to ESP32 over BLE only; ESP sends operator/session/jobs to the platform over MQTT.

## Flow

1. **Worker sign-in** — ID + name (stored on phone).
2. **Pin machine** — scan nearby `AC-###` devices, tick yours (matches floor label).
3. **Shift** — auto BLE connect/reconnect to pinned machine; START → jobs → end shift.
4. **End shift** or **Logout** — clears machine pin (must pick again next shift).

## Build

### CI APK (no Android SDK on your PC)

GitHub Actions builds a sideload APK on tag `worker-v*` or **Actions → Android APK — Worker (release) → Run workflow**.

1. Push this repo (or merge the workflow on `main`).
2. Either:
   - **Manual:** GitHub → Actions → *Android APK — Worker (release)* → *Run workflow*, then download the artifact `autoconnecto-worker-release-apk`.
   - **Release:** `git tag worker-v1.0.0 && git push origin worker-v1.0.0` — APK attached to the GitHub Release.

### Local (requires Android SDK)

```bash
cd tools/machine-worker-app
npm install
npx expo prebuild --platform android
npx expo run:android
```

Requires a **development build** (not Expo Go) for BLE.

## Pin / reconnect rules

| Action | Pin cleared? |
|--------|----------------|
| End shift | Yes |
| Logout | Yes (+ worker profile) |
| Change machine | Yes (pick another) |
| BLE drop (tea break) | **No** — app reconnects automatically |

## Contract

[`sdk/MACHINE_RUNTIME_BLE.md`](../../sdk/MACHINE_RUNTIME_BLE.md)

## E2E

[`E2E_TEST.md`](./E2E_TEST.md)
