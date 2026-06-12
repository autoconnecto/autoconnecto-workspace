# E2E — BLE worker app (no platform on phone)

## 1. Fleet widget Setup

- Add machine: `PRESS01`, slot `1`, allow run ✓
- Copy device token for ESP flash

## 2. Flash ESP

- `tools/machine-runtime-ble/Machine_Runtime_BLE_mqtt/`
- `LOCAL_DEV 1`, WiFi, token
- Serial: `[BLE] advertising as AC-001`

## 3. Worker app

Install **`autoconnecto-worker.apk`** from GitHub Actions (or build locally).

On first scan, allow **Nearby devices** (Android 12+) and **Location** when prompted.

| Step | Expected |
|------|----------|
| Worker sign-in | ID + name saved |
| Scan / pin AC-001 | Pin saved for shift |
| Auto connect | Status: Connected |
| START SESSION | Session ON, SSR if allow_run |
| Walk away 2 min, return | Reconnecting → Connected, session still ON |
| + ONE MORE JOB | jobs increment |
| End shift | Pin cleared → pick machine again |
| Logout | Profile cleared → worker sign-in |

## 4. Second worker blocked

- Worker A: pin + START on AC-001
- Worker B: pin AC-001, START → “Machine in use by …”

## 5. Dashboard

- Fleet widget shows operator name, jobs, session (via ESP MQTT)

## Troubleshooting scan

| Symptom | Check |
|---------|--------|
| App scans, no AC-### | Serial must show `[BLE] advertising as AC-00N`. If only MQTT logs, BLE did not start — look for `[BLE] low heap` and power-cycle ESP. |
| Wrong label | `machine_slot` 1 → **AC-001** (not AC-007). |
| Permissions | Settings → Autoconnecto Worker → Permissions → Nearby devices + Location **Allowed**. |
| MQTT OK, no BLE | Reflash `Machine_Runtime_BLE_mqtt.ino` (not NFC / non-BLE runtime sketch). |
