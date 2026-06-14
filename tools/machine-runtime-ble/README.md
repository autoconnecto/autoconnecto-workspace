# Machine runtime BLE (Rev 3)

Worker **Android app** + **ESP32 BLE** — no PN532 on machine.

## Sketch

`Machine_Runtime_BLE_mqtt/Machine_Runtime_BLE_mqtt.ino`

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
