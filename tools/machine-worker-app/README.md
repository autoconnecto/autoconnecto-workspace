# Autoconnecto Worker (Android, BLE-only)

Operator app for machine sessions. **No cloud login** — phone talks to ESP32 over BLE only; ESP sends operator/session/jobs to the platform over MQTT.

## Flow

1. **Worker profile** — ID + name (saved on phone until you tap **Edit profile**).
2. **Select machine** — scan once, pick your `AC-###` press (saved until you tap **Change machine**).
3. **Shift** — auto BLE connect/reconnect; **START SESSION** → **+ / −** jobs → **End shift**.
4. **End shift** — stops session only; machine assignment stays.
5. **Change machine** — only way to pick a different press.

## Download (recommended)

| Where | Link |
|-------|------|
| **Platform (logged in)** | Top bar → **Worker app** |
| **This repo** | [`autoconnecto-worker.apk`](./autoconnecto-worker.apk) (v1.2.7) |
| **GitHub Release** | https://github.com/autoconnecto/autoconnecto-workspace/releases/latest/download/autoconnecto-worker.apk |

All releases: https://github.com/autoconnecto/autoconnecto-workspace/releases

See also [`../README.md`](../README.md) (tools index).

## Build / release

### Ship a new version (GitHub Release + APK)

1. Bump `version` in `package.json` and `app.json`.
2. Commit and push to `main`.
3. Tag and push (CI builds the APK and attaches it to the release):

```bash
git tag worker-v1.2.1
git push origin worker-v1.2.1
```

Use tag prefix **`worker-v`** (e.g. `worker-v1.2.1`). Match the app version in `package.json`.

### CI only (no Release page)

**Actions → Android APK — Worker (release) → Run workflow** — download artifact `autoconnecto-worker-release-apk` (for testing before tagging).

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
