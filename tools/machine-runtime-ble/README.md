# Machine runtime BLE (Rev 3)

Worker **Android app** + **ESP32 BLE** — no PN532 on machine.

## Dual ESP32 (recommended for stability)

Two boards back-to-back — **no WiFi+BLE on one chip**:

| Board | Sketch | Role |
|-------|--------|------|
| **esp_ble** | [`esp_ble/esp_ble.ino`](esp_ble/esp_ble.ino) | NimBLE GATT only → worker app |
| **esp_wifi** | [`esp_wifi/esp_wifi.ino`](esp_wifi/esp_wifi.ino) | WiFi, MQTT, PZEM, SSR, session/NVS |

**UART (115200, cross-connect):**

```
esp_ble TX=19  →  esp_wifi RX=21
esp_ble RX=21  ←  esp_wifi TX=19
GND ↔ GND
```

Both sketches use **TX=GPIO19, RX=GPIO21**. Verify with [`link_test/link_test.ino`](link_test/link_test.ino) before loading production firmware.

**Flash order:** `esp_wifi` first (powers session/MQTT), then `esp_ble`.

**Libraries:** esp_ble → ArduinoJson + NimBLE-Arduino. esp_wifi → AutoconnectoSDK + ArduinoJson.

**Partition:** esp_wifi → **Huge APP**. esp_ble → default OK.

Worker app and GATT UUIDs unchanged. UART uses newline JSON — same `cmd` objects as BLE writes; esp_wifi replies with `{"type":"status",...}`.

### UART OK but worker app stuck on “Connecting / Retrying”

Monitor **esp_ble** Serial (not esp_wifi). You need **both** lines:

```
[BLE] advertising as AC-001
[LINK] → {"cmd":"get_status"}
[LINK] ← {"type":"status",...}
```

`[LINK]` alone means the bridge works — it does **not** prove the phone can see BLE. If `[BLE]` is missing, reflash **esp_ble** (NimBLE-Arduino installed).

After a failed phone connect, esp_ble must restart advertising every ~5 s (`[BLE] advertising restart (no_peers)`). Reflash latest **esp_ble** if the app never finds AC-001 again until power-cycle.

**Phone checks:** Bluetooth + Location ON; Worker app → Nearby devices allowed; tap **Change machine → Scan again** (clears stale BLE address). Optional: nRF Connect → scan for **AC-001** and service `a7c50001-...`.

### Phone sees nothing (ESP shows adv=yes)

1. **Unplug esp_wifi** — WiFi on the adjacent board can jam BLE discovery. Test **esp_ble alone** (only USB power, no UART wire needed for this test).
2. Flash [`ble_adv_test/ble_adv_test.ino`](ble_adv_test/ble_adv_test.ino) on esp_ble — minimal advert, no UART. nRF Connect must show **AC-001** within 1 m.
3. If **ble_adv_test** also invisible → hardware/antenna/USB power issue on esp_ble board, or phone BT/Location off.
4. If **ble_adv_test works** but **esp_ble.ino** does not → reflash latest esp_ble (split advert: UUID primary, name scan response).
5. Reflash esp_ble after edits; look for `[BLE] adv->start() FAILED` in serial (means advert packet rejected).

## Single ESP32 (legacy)

`Machine_Runtime_BLE_mqtt/Machine_Runtime_BLE_mqtt.ino` — BLE + WiFi on one board (coexistence can reboot).

### Local dev (LAN backend)

In the `.ino`, set `#define LOCAL_DEV 1` and edit `192.168.68.107` if your PC IP differs.

| Service | Local URL |
|---------|-----------|
| MQTT | `mqtt://<PC-IP>:1883` (EMQX docker) |
| HTTP API | `http://<PC-IP>:3000` |
| Device token | **Copy token** from Fleet Setup → Edit machine (or Device Details). **Not** the Device ID. |

Set `#define LOCAL_DEV 0` for production (`mqtt.autoconnecto.in`).

### Wrong token symptoms (backend logs)

If the sketch uses **Device ID** instead of **device token**, you will see:

- `Invalid device token` on telemetry
- `Device not found for token <uuid>`
- ESP serial: `[SYNC]` requests but **no** `[ATTR] machine_allow_run = ...` lines
- Worker app: **ALLOW RUN BLOCKED** forever (attrs never reach ESP)

**Libraries:** AutoconnectoSDK, ArduinoJson, **NimBLE-Arduino** (Library Manager → search `NimBLE-Arduino` by h2zero)

**Wiring:** PZEM UART2 RX=16 TX=17, SSR GPIO **2**, 3.3V/5V, GND

**Arduino IDE (required):**

| Setting | Value |
|---------|--------|
| Partition Scheme | **Huge APP (3MB No OTA/1MB SPIFFS)** |
| Core Debug Level | **None** |

Without Huge APP, BLE + WiFi + MQTT exceeds default 1.3 MB flash.

## Owner setup

1. Flash sketch (WiFi + device token).  
2. In dashboard, device **SHARED** attributes:
   - `machine_slot` = `7` (number)  
   - `machine_code` = `PRESS07` (string)  
3. ESP advertises **`AC-007`**.

## CPU cores + radio coexistence

ESP32 is **dual-core**, but WiFi and BLE share **one 2.4 GHz radio** — separate cores do **not** mean separate antennas. Cores only help when one stack was starving the other for CPU time.

**Firmware layout (latest sketch):**

| Workload | Core | Notes |
|----------|------|--------|
| WiFi + MQTT pump (`sdk.loop`) | **Core 0** (PRO_CPU) | Dedicated FreeRTOS task |
| BLE watchdog, PZEM, session, `loop()` | **Core 1** (APP_CPU) | Arduino default |
| NimBLE / WiFi controller tasks | ESP-IDF defaults | Usually Core 0 |

**Coexistence preference** (time-slicing the radio):

- Phone connected over BLE → `ESP_COEX_PREFER_BT`
- Session active, phone away → `ESP_COEX_PREFER_BALANCE`
- Idle → `ESP_COEX_PREFER_WIFI` (MQTT keepalive)

Serial after boot should include:

```
[CPU] mqtt pump pinned core 0
[CPU] setup running on core 1
```

## MQTT `errno=119` / ping timeout

Occasional `mqtt_client: Writing didn't complete` / `errno=119` after long uptime is usually **WiFi + BLE sharing the radio** or the **PC broker sleeping** — the SDK reconnects automatically (`Reconnecting MQTT…` → `MQTT CONNECTED`). Not a corrupt sketch if attrs/telemetry resume.

Mitigations: keep dev PC awake, ESP on stable WiFi, reflash latest sketch (WiFi coexist preference + faster `loop()`). Reflash after edits.

`machine_allow_run = false` with `machine_tool_remaining = 0` is **tool life exhausted** — reset tool life in dashboard Setup, not an MQTT bug.

## Serial — BLE must be on

After boot you should see:

```
[BLE] starting early (pre-MQTT)
[BLE] advertising as AC-001
[BLE] status (boot) inited=yes name=AC-001 heap=...
```

If you only see MQTT/`[SYNC]` lines and `inited=no`, open Serial Monitor **before** reset, confirm **Huge APP** partition and **NimBLE-Arduino** installed, then reflash.

**Scan finds nothing after phone disconnect:** firmware now reconciles advertising every 5 s using real GATT peer count (Android often skips `onDisconnect`). Reflash latest sketch; serial should log `advertising restart (no_peers)` without power-cycling the ESP.

## Test without Android app

Use **nRF Connect** (Android):

1. Scan for `AC-007`  
2. Connect → service `a7c50001-...`  
3. Write to cmd char: `{"cmd":"start","operator_id":"test1","operator_name":"Test"}`  
4. SSR should energize (if `machine_allow_run` true)  
5. Write `{"cmd":"job_add"}`  
6. Write `{"cmd":"stop"}`  

Contract: [`sdk/MACHINE_RUNTIME_BLE.md`](../../sdk/MACHINE_RUNTIME_BLE.md)
