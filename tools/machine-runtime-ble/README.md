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
| Device token | Copy from **local** Device Details (not production) |

Set `#define LOCAL_DEV 0` for production (`mqtt.autoconnecto.in`).

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

## Serial — BLE must be on

After boot you should see:

```
[BLE] starting early (pre-MQTT)
[BLE] advertising as AC-001
[BLE] status (boot) inited=yes name=AC-001 heap=...
```

If you only see MQTT/`[SYNC]` lines and `inited=no`, open Serial Monitor **before** reset, confirm **Huge APP** partition and **NimBLE-Arduino** installed, then reflash.

## Test without Android app

Use **nRF Connect** (Android):

1. Scan for `AC-007`  
2. Connect → service `a7c50001-...`  
3. Write to cmd char: `{"cmd":"start","operator_id":"test1","operator_name":"Test"}`  
4. SSR should energize (if `machine_allow_run` true)  
5. Write `{"cmd":"job_add"}`  
6. Write `{"cmd":"stop"}`  

Contract: [`sdk/MACHINE_RUNTIME_BLE.md`](../../sdk/MACHINE_RUNTIME_BLE.md)
