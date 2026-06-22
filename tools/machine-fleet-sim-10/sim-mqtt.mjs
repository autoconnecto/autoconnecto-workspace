/**
 * PC MQTT simulator — 10 machines, Rev 2 NFC + tool life (owner demo).
 *
 * Run: cd backend && node ../tools/machine-fleet-sim-10/sim-mqtt.mjs
 */

import mqtt from "mqtt";

const MQTT_HOST = process.env.MQTT_HOST || "127.0.0.1";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const TELEMETRY_MS = Number(process.env.TELEMETRY_MS || 10_000);

const DEVICE_TOKENS = [
  "88d6da44-3a99-4373-94c7-9d1d1aa40be7",
  "ff13ef77-56f0-4805-b865-2495ffd49734",
  "88b88a74-4af8-4424-9461-c97c2ce7088a",
  "e4f9e53f-f312-46e0-91bd-63db4644c05a",
  "2e4a59b6-535f-4cfe-ac73-5706a66b3038",
  "afb363fb-0b29-421e-b291-8c06aca19ece",
  "72c6a849-2ce5-4760-94a5-e1bfb673d74a",
  "950848a4-d873-4779-b433-b6d99605fc53",
  "5ea53525-9868-4be3-bbd8-b9f2f1868395",
  "840415bf-a261-45b1-a76a-4fd29d896266",
];

const WORKER_IDS = ["worker1", "worker2", "worker3", "worker4"];
const WORKER_NAMES = ["Rajesh Kumar", "Priya Singh", "Amit Patel", "Suresh Nair"];

const DEVICE_PROFILES = [
  { exhausted: true, limit: 20, used: 20 },
  { exhausted: false, limit: 35, used: 12 },
  { exhausted: false, limit: 0, used: 0 },
  { exhausted: false, limit: 0, used: 0 },
  { exhausted: false, limit: 0, used: 0 },
  { exhausted: false, limit: 0, used: 0 },
  { exhausted: false, limit: 0, used: 0 },
  { exhausted: false, limit: 10, used: 7 },
  { exhausted: true, limit: 12, used: 12 },
  { exhausted: false, limit: 0, used: 0 },
];

const PHASES = [
  { name: "off", ms: 20_000, amp: 0.15 },
  { name: "idle", ms: 15_000, amp: 3.5 },
  { name: "load", ms: 12_000, amp: 18 },
];

const jobCounters = DEVICE_PROFILES.map((p) => ({ ...p }));

function phaseAt(t, deviceIdx) {
  const cycle = PHASES.reduce((s, p) => s + p.ms, 0);
  let x = (t + deviceIdx * 4000) % cycle;
  for (const p of PHASES) {
    if (x < p.ms) return p;
    x -= p.ms;
  }
  return PHASES[0];
}

function workerFor(deviceIdx, t) {
  const wi = Math.floor((t / (12 * 60 * 1000) + deviceIdx) % WORKER_IDS.length);
  const inBlock = t % (12 * 60 * 1000);
  const login = inBlock < (12 * 60 * 1000 * 3) / 4;
  const phase = phaseAt(t, deviceIdx);
  const sessionActive = login && phase.name !== "off";
  return { wi, sessionActive };
}

function payloadFor(deviceIdx, t) {
  const prof = jobCounters[deviceIdx];
  const phase = phaseAt(t, deviceIdx);
  const { wi, sessionActive } = workerFor(deviceIdx, t);

  let exhausted = prof.exhausted;
  let amp = phase.amp;

  if (prof.limit > 0 && !exhausted) {
    if (phase.name === "load") {
      prof.used += 0.02;
      if (prof.used >= prof.limit) {
        prof.exhausted = true;
        exhausted = true;
      }
    }
  }

  if (exhausted) {
    amp = 0.15;
  }

  const volts = exhausted || phase.name === "off" ? 0 : 230 + (t % 5);

  const doc = {
    machine_current_a: amp + (t % 1000) / 10000,
    machine_voltage_v: volts,
    machine_sensor_ok: true,
    machine_session_active: exhausted ? false : sessionActive,
  };

  if (prof.limit > 0) {
    doc.machine_tool_life_enabled = true;
    doc.machine_tool_life_limit = prof.limit;
    doc.machine_tool_remaining = exhausted ? 0 : Math.max(0, Math.floor(prof.limit - prof.used));
    doc.machine_tool_life_exhausted = exhausted;
    doc.machine_allow_run = !exhausted;
  }

  if (sessionActive && !exhausted) {
    doc.machine_operator_id = WORKER_IDS[wi];
    doc.machine_operator_name = WORKER_NAMES[wi];
  }

  return doc;
}

const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const client = mqtt.connect(url, {
  clientId: `machine-fleet-sim-pc-${Date.now()}`,
  protocolVersion: 4,
  reconnectPeriod: 3000,
});

client.on("connect", () => {
  console.log(`[sim-mqtt] connected ${url}`);
  console.log("[sim-mqtt] Tool stopped: devices 0 & 8 (tokens sim01/sim09)");
  setInterval(() => {
    const t = Date.now();
    for (let i = 0; i < DEVICE_TOKENS.length; i++) {
      const topic = `devices/${DEVICE_TOKENS[i]}/telemetry`;
      client.publish(topic, JSON.stringify(payloadFor(i, t)), { qos: 0 });
    }
  }, TELEMETRY_MS);
});

client.on("error", (err) => console.error("[sim-mqtt]", err.message));
