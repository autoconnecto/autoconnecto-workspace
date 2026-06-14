# E2E — BLE worker app (no platform on phone)

## 1. Fleet widget Setup

- Add machine: `PRESS01`, slot `1`, allow run ✓
- Copy device token for ESP flash

## 2. Flash ESP

- `tools/machine-runtime-ble/Machine_Runtime_BLE_mqtt/`
- `LOCAL_DEV 1`, WiFi, token
- Serial after reset: `[BLE] advertising as AC-001` and `[BLE] status (periodic) inited=yes`

## 3. Worker app

Install **`autoconnecto-worker.apk`** from GitHub Actions (or build locally).

On first scan, allow **Nearby devices** (Android 12+) and **Location** when prompted. Enable **system Location** toggle.

| Step | Expected |
|------|----------|
| Worker profile | ID + name saved on phone |
| Select AC-001 | Assignment saved until Change machine |
| Reopen app next day | Goes straight to shift screen (no rescan) |
| Auto connect | Status: Connected |
| START SESSION | Session ON, SSR if allow_run |
| Walk away 2 min, return | Reconnecting → Connected, session still ON |
| Tap **+** | jobs increment |
| Tap **−** | jobs decrement |
| End shift | Session OFF; machine assignment **kept** |
| Edit profile | Change name/ID; assignment kept |
| Change machine | Pick another press |

## 4. Second worker blocked

- Worker A: pin + START on AC-001
- Worker B: pin AC-001, START → “Machine in use by …”

## 5. Dashboard

- Fleet widget shows operator name, jobs, session (via ESP MQTT)

## BLE advertising recovery (no power cycle)

If the phone walked away and scan finds nothing, open ESP serial (115200). Within **~5 s** you should see one of:

- `[BLE] ghost link cleared — no GATT peers`
- `[BLE] advertising restart (no_peers)`
- `[BLE] drop 1 peer(s): stale_gatt`

If you never see those lines, reflash the latest `Machine_Runtime_BLE_mqtt.ino` (advertising reconcile watchdog).

## Troubleshooting scan

| Symptom | Check |
|---------|--------|
| App scans, no AC-### | Check serial for `[BLE] advertising restart` every ~5 s. Reflash latest firmware if missing. Stand within 2 m; tap **Scan again** on phone. |
| Wrong label | `machine_slot` 1 → **AC-001** (not AC-007). |
| Permissions | Settings → Autoconnecto Worker → Nearby devices + Location **Allowed**; system Location **ON**. |
| MQTT OK, no BLE | Reflash `Machine_Runtime_BLE_mqtt.ino` (not NFC / non-BLE runtime sketch). |
