# Autoconnecto Worker (Android, BLE-only)

Operator app for machine sessions. **No cloud login** — phone talks to ESP32 over BLE only; ESP sends operator/session/jobs to the platform over MQTT.

## Flow

1. **Worker profile** — ID + name (saved on phone until you tap **Edit profile**).
2. **Select machine** — scan once, pick your `AC-###` press (saved until you tap **Change machine**).
3. **Shift** — auto BLE connect/reconnect; **START SESSION** → **+ / −** jobs → **End shift**.
4. **End shift** — stops session only; machine assignment stays.
5. **Change machine** — only way to pick a different press.

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

## Persistence rules

| Action | Worker profile | Machine assignment |
|--------|----------------|-------------------|
| End shift | Kept | Kept |
| Edit profile | Updated on save | Kept |
| Change machine | Kept | Cleared → pick again |
| BLE drop (tea break) | Kept | Kept — auto-reconnect |
| App restart | Kept | Kept — opens shift screen |
| Scan fails twice | — | Tap Scan again (auto-resets BLE stack) |

## Contract

[`sdk/MACHINE_RUNTIME_BLE.md`](../../sdk/MACHINE_RUNTIME_BLE.md)

## E2E

[`E2E_TEST.md`](./E2E_TEST.md)
