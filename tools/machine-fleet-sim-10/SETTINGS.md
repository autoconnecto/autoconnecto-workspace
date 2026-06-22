# Machine fleet sim — 10 devices

Use the same **device type** on all 10 devices in the platform (e.g. `machine`).  
In the **Machine Fleet Runtime** widget config, set thresholds below then **Save thresholds (platform)**.

## Thresholds (all 10 machines)

| Field | Value (A) | Notes |
|-------|-----------|--------|
| **Off A** | **0** | I ≤ 0 → Off |
| **Idle A** | **2** | Off load (powered, not working) |
| **Load A** | **5** | On load |
| **On A** | **5** | Same as Load (2-level OK) |

Simulated telemetry uses roughly: **0.15 A** (off), **3.5 A** (idle), **18 A** (on load).

---

## Per-device token and behaviour

| # | Name (suggested) | Device token | Sim profile | What to verify |
|---|------------------|--------------|-------------|----------------|
| 1 | sim01 | `88d6da44-3a99-4373-94c7-9d1d1aa40be7` | Standard cycle | Baseline jobs, productivity bars |
| 2 | sim02 | `ff13ef77-56f0-4805-b865-2495ffd49734` | Fast jobs | Higher job count vs sim01 |
| 3 | sim03 | `88b88a74-4af8-4424-9461-c97c2ce7088a` | Mostly off | Off KPI, downtime in culprits |
| 4 | sim04 | `e4f9e53f-f312-46e0-91bd-63db4644c05a` | Mostly load | On load KPI, productivity on-load line |
| 5 | sim05 | `2e4a59b6-535f-4cfe-ac73-5706a66b3038` | Operator (fast RFID) | Shorter login blocks; same worker1–4 rotation |
| 6 | sim06 | `afb363fb-0b29-421e-b291-8c06aca19ece` | Stale | **Stale** KPI (publishes every 4 min only) |
| 7 | sim07 | `72c6a849-2ce5-4760-94a5-e1bfb673d74a` | Sensor fault | Occasional `machine_sensor_ok: false` |
| 8 | sim08 | `950848a4-d873-4779-b433-b6d99605fc53` | Slow jobs | Fewer jobs over same time window |
| 9 | sim09 | `5ea53525-9868-4be3-bbd8-b9f2f1868395` | Two-level | Widget Idle = Load (5); only 0 A / 18 A in sim |
| 10 | sim10 | `840415bf-a261-45b1-a76a-4fd29d896266` | Mixed | Irregular load pattern |

### Workers (NFC sim — telemetry only)

Sim publishes Rev 2 fields when `machine_session_active` is true:

| `machine_operator_id` | `machine_operator_name` |
|-----------------------|-------------------------|
| worker1 | Rajesh Kumar |
| worker2 | Priya Singh |
| worker3 | Amit Patel |
| worker4 | Suresh Nair |

No worker list in dashboard config. See `DASHBOARD_TEST.md`.

Each machine rotates workers every **12 min**; logged in ~75% of that block while not in **off** phase. **sim06** (stale) does not send operator telemetry.

### Tool life (optional test)

Enable on **sim01**, **sim02**, **sim08**:

| Machine | Max jobs | Purpose |
|---------|----------|---------|
| sim01 | 500 | Normal decrement |
| sim02 | 30 | Hits stop sooner (fast jobs) |
| sim08 | 10 | Two-level + tool life |

After ~30–60 min with sim running, check **Jobs** / **Tool** columns and **Tool stopped** KPI.

---

## MQTT (local)

| Setting | Value |
|---------|--------|
| Host | `192.168.68.107` |
| Port | `1883` (plain TCP) |
| Topic | `devices/<token>/telemetry` |
| Payload | JSON, e.g. `{"machine_current_a":18.0,"machine_voltage_v":230,"machine_sensor_ok":true}` |

Backend must use the same broker (`MQTT_BROKER_URL=mqtt://192.168.68.107:1883` or your EMQX/Mosquitto).

---

## PC simulator (no ESP)

```bash
cd backend
node ../tools/machine-fleet-sim-10/sim-mqtt.mjs
```

## Flash (ESP)

1. Open `tools/machine-fleet-sim-10/machine_fleet_sim_10.ino` in Arduino IDE.
2. Install **PubSubClient** + **ArduinoJson**.
3. Board: **ESP32 Dev Module**.
4. Upload; Serial Monitor **115200** — you should see `[sim01] ... I=...` every 10 s.

---

## Job cycle timing (reference)

One **job** = no-load → on-load (≥10 s) → no-load (≥3 s).  
Standard profile phases: **Off 20 s → Idle 15 s → Load 12 s → Off** (repeat).
