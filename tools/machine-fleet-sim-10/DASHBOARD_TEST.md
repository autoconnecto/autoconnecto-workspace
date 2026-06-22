# Dashboard test without PN532 (align + verify)

Use this before RFID hardware arrives. Operator names come from **MQTT telemetry only** — no worker list in widget settings.

## 1. Broker + backend

1. Run Mosquitto/EMQX on your PC (e.g. `127.0.0.1:1883` or LAN IP).
2. Set backend `MQTT_BROKER_URL` to the same host (e.g. `mqtt://192.168.68.107:1883`).
3. Restart backend so it ingests telemetry.

## 2. Ten platform devices

Create or use the 10 device tokens in `SETTINGS.md`. All should use the same **device type** (e.g. `machine`) with telemetry key `machine_current_a`.

## 3. Start simulator (pick one)

**PC (no ESP):**

```bash
cd backend
node ../tools/machine-fleet-sim-10/sim-mqtt.mjs
```

Optional: `MQTT_HOST=192.168.68.107 node ../tools/machine-fleet-sim-10/sim-mqtt.mjs`

**ESP32:** flash `machine_fleet_sim_10.ino` (see `SETTINGS.md`).

## 4. Widget on dashboard

1. Add **Machine Fleet Runtime** widget.
2. Select the 10 devices (or asset that contains them).
3. Thresholds: **Off 0 · Idle 2 · Load 5 · On 5** → Save thresholds (platform).
4. **Planned shift:** set **8 hours/day** in widget config (used for utilization %).
5. Fleet chart: pick **Output** or **Utilization** + **Last 7 days** — vertical bars with **↑/↓ vs previous period**.
6. Open a machine drawer: same metric dropdown + **Worker efficiency** / **Worker output** for NFC demo.
7. **Do not** add workers in config — names come from MQTT.

## 5. What you should see

| Area | Expected |
|------|----------|
| KPI row | On load / Off / Stale counts among 10 machines |
| Table **Worker** | e.g. `Rajesh Kumar (worker1)` when machine is on load and session active |
| Drawer | Metric dropdown + **vertical bar chart**; tool-stopped alert |
| Fleet chart | Output / Utilization / Throughput / Downtime + period (today → 30 days) |
| Tool stopped | sim01 & sim09 **off at 0 A**, `machine_tool_life_exhausted` in MQTT |
| sim02 / sim08 | Tool counting down — will stop after more jobs |
| sim06 (stale) | Stale KPI — publishes slowly in ESP sketch only |

## 6. Rev 2 NFC (later)

When PN532 + cards arrive: flash `tools/machine-runtime-nfc/Machine_Runtime_NFC_enroll/Machine_Runtime_NFC_enroll.ino` at desk, then `tools/machine-runtime-nfc/Machine_Runtime_NFC_mqtt/Machine_Runtime_NFC_mqtt.ino` on each machine. Same telemetry keys — dashboard unchanged.
