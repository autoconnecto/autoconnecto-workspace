/*
 * machine_fleet_sim_10.ino — LOCAL TEST ONLY (not part of SDK)
 *
 * One ESP32 publishes machine_current_a (and optional session keys) for 10
 * platform devices on your LAN MQTT broker. Topic format matches Autoconnecto:
 *   devices/<deviceToken>/telemetry
 *
 * Libraries (Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary
 *   - ArduinoJson by Benoit Blanchon (v6+)
 *
 * Board: ESP32 Dev Module
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ---- WiFi (your LAN) ----
static const char* WIFI_SSID = "71";
static const char* WIFI_PASSWORD = "90946062";

// ---- Local broker (dev PC) ----
static const char* MQTT_HOST = "192.168.68.107";
static const uint16_t MQTT_PORT = 1883;

static const uint32_t TELEMETRY_MS = 10000;
static const uint32_t MQTT_RECONNECT_MS = 5000;

// ---- 10 device tokens (must exist in platform) ----
static const char* DEVICE_TOKENS[] = {
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
};
static const size_t DEVICE_COUNT = sizeof(DEVICE_TOKENS) / sizeof(DEVICE_TOKENS[0]);

// Widget thresholds (amps) — configure the same in Machine Fleet widget
static const float TH_OFF = 0.0f;
static const float TH_IDLE = 2.0f;
static const float TH_LOAD = 5.0f;

// Simulated amp levels (3-level machines)
static const float AMP_OFF = 0.15f;
static const float AMP_IDLE = 3.5f;
static const float AMP_LOAD = 18.0f;

// Line voltage (PZEM) — must align with dashboard minSupplyVoltageV (default 80 V)
static const float V_LINE_ON = 230.0f;
static const float V_LINE_OFF = 0.0f;

// Rev 2 NFC sim — id + display name on "card" (matches Machine_Runtime_NFC_mqtt)
static const char* WORKER_IDS[] = {"worker1", "worker2", "worker3", "worker4"};
static const char* WORKER_NAMES[] = {
  "Rajesh Kumar", "Priya Singh", "Amit Patel", "Suresh Nair"};
static const uint8_t WORKERS_PER_MACHINE = 4;
static const uint32_t WORKER_BLOCK_MS = 12UL * 60UL * 1000UL;

static const uint32_t SIM_DAY_MS = 48UL * 60UL * 1000UL;

enum SimProfile : uint8_t {
  PROF_STANDARD = 0,   // normal job cycles
  PROF_FAST_JOBS = 1,  // more jobs / hour
  PROF_MOSTLY_OFF = 2, // downtime / off
  PROF_MOSTLY_LOAD = 3,// high on-load / productivity
  PROF_OPERATOR = 4,   // extra session churn (all machines still get workers)
  PROF_STALE = 5,      // rare publishes → Stale KPI
  PROF_SENSOR_FAULT = 6,
  PROF_SLOW_JOBS = 7,
  PROF_TWO_LEVEL = 8,  // skip idle band (2-level thresholds)
  PROF_MIXED = 9,      // irregular pattern
};

enum LoadPhase : uint8_t {
  PHASE_OFF = 0,
  PHASE_IDLE = 1,
  PHASE_LOAD = 2,
};

struct SimDevice {
  const char* token;
  const char* label;
  SimProfile profile;
  LoadPhase phase;
  uint32_t phaseEnteredMs;
  uint32_t phaseDurationsMs[3];
  uint8_t phaseOrder[4];
  uint8_t phaseOrderLen;
  uint8_t phaseOrderIdx;
  bool sessionActive;
  uint8_t workerIndex;
  uint32_t sessionToggleMs;
  uint32_t lastPublishMs;
  uint32_t publishIntervalMs;
  uint16_t tickCount;
  bool toolLifeEnabled;
  uint16_t toolLimit;
  uint16_t toolUsed;
  bool toolExhausted;
  bool allowRun;
};

static WiFiClient wifiClient;
static PubSubClient mqtt(wifiClient);
static char topicBuf[96];
static char jsonBuf[512];

static SimDevice devices[10];

static void initDeviceProfiles() {
  // 0 — standard + tool EXHAUSTED (owner demo: machine stopped)
  devices[0] = {
    DEVICE_TOKENS[0], "sim01", PROF_STANDARD,
    PHASE_OFF, 0, {20000, 15000, 12000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    true, 20, 20, true, false,
  };
  // 1 — fast jobs + tool life counting down
  devices[1] = {
    DEVICE_TOKENS[1], "sim02", PROF_FAST_JOBS,
    PHASE_OFF, 0, {12000, 8000, 10000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    true, 35, 12, false, true,
  };
  // 2 — mostly off
  devices[2] = {
    DEVICE_TOKENS[2], "sim03", PROF_MOSTLY_OFF,
    PHASE_OFF, 0, {55000, 8000, 6000}, {0, 0, 0, 1}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    false, 0, 0, false, true,
  };
  // 3 — mostly on load
  devices[3] = {
    DEVICE_TOKENS[3], "sim04", PROF_MOSTLY_LOAD,
    PHASE_LOAD, 0, {8000, 8000, 45000}, {2, 2, 1, 2}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    false, 0, 0, false, true,
  };
  // 4 — operator session
  devices[4] = {
    DEVICE_TOKENS[4], "sim05", PROF_OPERATOR,
    PHASE_OFF, 0, {18000, 12000, 12000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    false, 0, 0, false, true,
  };
  // 5 — stale (publish every 4 min)
  devices[5] = {
    DEVICE_TOKENS[5], "sim06", PROF_STALE,
    PHASE_IDLE, 0, {25000, 25000, 12000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, 240000, 0,
    false, 0, 0, false, true,
  };
  // 6 — sensor fault bursts
  devices[6] = {
    DEVICE_TOKENS[6], "sim07", PROF_SENSOR_FAULT,
    PHASE_OFF, 0, {20000, 15000, 12000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    false, 0, 0, false, true,
  };
  // 7 — slow jobs + tool life low
  devices[7] = {
    DEVICE_TOKENS[7], "sim08", PROF_SLOW_JOBS,
    PHASE_OFF, 0, {35000, 25000, 20000}, {0, 1, 2, 0}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    true, 10, 7, false, true,
  };
  // 8 — two-level + tool EXHAUSTED
  devices[8] = {
    DEVICE_TOKENS[8], "sim09", PROF_TWO_LEVEL,
    PHASE_OFF, 0, {22000, 0, 14000}, {0, 2, 0, 2}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    true, 12, 12, true, false,
  };
  // 9 — mixed / irregular
  devices[9] = {
    DEVICE_TOKENS[9], "sim10", PROF_MIXED,
    PHASE_IDLE, 0, {14000, 14000, 9000}, {1, 2, 0, 2}, 4, 0,
    false, 0, 0, 0, TELEMETRY_MS, 0,
    false, 0, 0, false, true,
  };

  const uint32_t now = millis();
  for (size_t i = 0; i < DEVICE_COUNT; i++) {
    devices[i].phaseEnteredMs = now - (i * 3500UL);
    devices[i].sessionToggleMs = now;
    devices[i].lastPublishMs = 0;
  }
}

static void wifiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Connecting");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] OK ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WiFi] FAILED");
  }
}

static void mqttConnect() {
  if (mqtt.connected()) return;
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  const String clientId = String("fleet-sim-") + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.print("[MQTT] Connecting ");
  Serial.println(MQTT_HOST);
  if (mqtt.connect(clientId.c_str())) {
    Serial.println("[MQTT] connected (single client, multi-device topics)");
  } else {
    Serial.print("[MQTT] failed, rc=");
    Serial.println(mqtt.state());
  }
}

static LoadPhase currentPhase(const SimDevice& d) {
  if (d.phaseOrderLen > 0) {
    return (LoadPhase)d.phaseOrder[d.phaseOrderIdx % d.phaseOrderLen];
  }
  return d.phase;
}

static void countToolJobIfNeeded(SimDevice& d, LoadPhase leaving) {
  if (!d.toolLifeEnabled || d.toolExhausted || leaving != PHASE_LOAD) return;
  d.toolUsed++;
  if (d.toolUsed >= d.toolLimit) {
    d.toolExhausted = true;
    d.allowRun = false;
    d.sessionActive = false;
    Serial.printf("[%s] TOOL LIFE OVER — machine stopped (jobs %u/%u)\n",
                  d.label, (unsigned)d.toolUsed, (unsigned)d.toolLimit);
  }
}

static void advancePhase(SimDevice& d) {
  const LoadPhase leaving = currentPhase(d);
  d.phaseOrderIdx = (uint8_t)((d.phaseOrderIdx + 1) % d.phaseOrderLen);
  LoadPhase next = currentPhase(d);
  d.phase = next;
  d.phaseEnteredMs = millis();
  countToolJobIfNeeded(d, leaving);
}

static void tickPhaseMachine(SimDevice& d) {
  LoadPhase ph = currentPhase(d);
  uint32_t dur = d.phaseDurationsMs[ph];
  if (d.profile == PROF_TWO_LEVEL && ph == PHASE_IDLE) {
    dur = 0;
  }
  if (dur == 0) {
    advancePhase(d);
    return;
  }
  if (millis() - d.phaseEnteredMs >= dur) {
    advancePhase(d);
  }
}

static float ampsForPhase(LoadPhase ph, SimProfile profile) {
  if (profile == PROF_TWO_LEVEL) {
    if (ph == PHASE_LOAD) return AMP_LOAD;
    return AMP_OFF;
  }
  if (ph == PHASE_OFF) return AMP_OFF;
  if (ph == PHASE_IDLE) return AMP_IDLE;
  return AMP_LOAD;
}

static float voltageForPhase(const SimDevice& d, LoadPhase ph) {
  if (d.toolExhausted || (d.toolLifeEnabled && !d.allowRun)) {
    return V_LINE_OFF;
  }
  if (ph == PHASE_OFF) {
    return V_LINE_OFF;
  }
  return V_LINE_ON + (float)((millis() / 1000) % 5);
}

static float ampsForDevice(SimDevice& d) {
  if (d.toolExhausted || (d.toolLifeEnabled && !d.allowRun)) {
    return AMP_OFF;
  }

  tickPhaseMachine(d);

  if (d.profile == PROF_MOSTLY_OFF && currentPhase(d) != PHASE_LOAD) {
    return AMP_OFF;
  }
  if (d.profile == PROF_MOSTLY_LOAD && currentPhase(d) != PHASE_OFF) {
    return AMP_LOAD + (float)(millis() % 2000) / 1000.0f;
  }
  if (d.profile == PROF_MIXED) {
    const uint32_t t = (millis() / 7000UL) % 4UL;
    if (t == 0) return AMP_OFF;
    if (t == 1) return AMP_IDLE;
    if (t == 2) return AMP_LOAD;
    return 4.5f;
  }

  LoadPhase ph = currentPhase(d);
  float base = ampsForPhase(ph, d.profile);

  if (d.profile == PROF_SENSOR_FAULT && (d.tickCount % 7) == 0) {
    return 0.0f;
  }

  return base + (float)((millis() / 1000) % 5) * 0.05f;
}

static bool sensorOkForDevice(SimDevice& d) {
  if (d.profile == PROF_SENSOR_FAULT) {
    return (d.tickCount % 7) != 0;
  }
  return true;
}

static uint8_t workerSlotForDevice(size_t deviceIdx) {
  const uint32_t dayPhase = (millis() / SIM_DAY_MS) % WORKERS_PER_MACHINE;
  const uint32_t blockSlot = (millis() / WORKER_BLOCK_MS + deviceIdx) % WORKERS_PER_MACHINE;
  return (uint8_t)((dayPhase + blockSlot) % WORKERS_PER_MACHINE);
}

static void updateWorkerSession(SimDevice& d, size_t deviceIdx) {
  if (d.profile == PROF_STALE) {
    d.sessionActive = false;
    d.workerIndex = 0;
    return;
  }

  if (d.toolExhausted) {
    d.sessionActive = false;
    return;
  }

  const LoadPhase ph = currentPhase(d);
  if (ph == PHASE_OFF) {
    d.sessionActive = false;
    return;
  }

  const uint8_t wi = workerSlotForDevice(deviceIdx);
  const uint32_t inBlock = millis() % WORKER_BLOCK_MS;
  uint32_t loginMs = (WORKER_BLOCK_MS * 3) / 4;

  if (d.profile == PROF_OPERATOR) {
    loginMs = WORKER_BLOCK_MS / 2;
  }

  const bool login = inBlock < loginMs;
  d.workerIndex = wi;

  if (login) {
    if (!d.sessionActive) {
      Serial.printf("[%s] NFC IN %s (%s)\n", d.label, WORKER_NAMES[wi], WORKER_IDS[wi]);
    }
    d.sessionActive = true;
  } else {
    if (d.sessionActive) {
      Serial.printf("[%s] RFID OUT %s\n", d.label, WORKER_NAMES[wi]);
    }
    d.sessionActive = false;
  }
}

static bool publishTelemetry(SimDevice& d) {
  snprintf(topicBuf, sizeof(topicBuf), "devices/%s/telemetry", d.token);

  const float amps = ampsForDevice(d);
  const bool sensorOk = sensorOkForDevice(d);
  LoadPhase ph = currentPhase(d);

  const float volts = voltageForPhase(d, ph);

  StaticJsonDocument<384> doc;
  doc["machine_current_a"] = amps;
  doc["machine_voltage_v"] = volts;
  doc["machine_sensor_ok"] = sensorOk;
  doc["machine_session_active"] = d.sessionActive;

  if (d.toolLifeEnabled) {
    doc["machine_tool_life_enabled"] = true;
    doc["machine_tool_life_limit"] = d.toolLimit;
    doc["machine_tool_remaining"] = d.toolExhausted
                                      ? 0
                                      : (int)((int)d.toolLimit - (int)d.toolUsed);
    doc["machine_tool_life_exhausted"] = d.toolExhausted;
    doc["machine_allow_run"] = d.allowRun && !d.toolExhausted;
  }

  if (d.sessionActive) {
    const uint8_t wi = d.workerIndex % WORKERS_PER_MACHINE;
    doc["machine_operator_id"] = WORKER_IDS[wi];
    doc["machine_operator_name"] = WORKER_NAMES[wi];
  }

  const size_t n = serializeJson(doc, jsonBuf, sizeof(jsonBuf));
  if (!n) return false;

  const bool ok = mqtt.publish(topicBuf, jsonBuf, false);
  if (ok) {
    Serial.printf("[%s] %s I=%.2f V=%.1f phase=%u sess=%d -> %s\n",
                  d.label,
                  d.token,
                  amps,
                  volts,
                  (unsigned)ph,
                  d.sessionActive ? 1 : 0,
                  topicBuf);
  }
  return ok;
}

static void publishAll() {
  const uint32_t now = millis();
  for (size_t i = 0; i < DEVICE_COUNT; i++) {
    SimDevice& d = devices[i];
    updateWorkerSession(d, i);

    if (d.lastPublishMs != 0 && (now - d.lastPublishMs) < d.publishIntervalMs) {
      continue;
    }

    d.tickCount++;
    if (publishTelemetry(d)) {
      d.lastPublishMs = now;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n=== Machine Fleet 10-device simulator (LOCAL) ===");
  initDeviceProfiles();
  wifiConnect();
  mqttConnect();
  Serial.println("Thresholds for widget config: Off=0 Idle=2 Load=5 On=5");
  Serial.println("Telemetry: machine_current_a + machine_voltage_v (V=0 off, ~230V on load/idle).");
  Serial.println("Tool life: sim01/sim09 STOPPED; sim02/sim08 counting down.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnect();
  }
  if (!mqtt.connected()) {
    mqttConnect();
    delay(MQTT_RECONNECT_MS);
    return;
  }
  mqtt.loop();

  static uint32_t lastTelemMs = 0;
  const uint32_t now = millis();
  if (now - lastTelemMs >= TELEMETRY_MS) {
    lastTelemMs = now;
    publishAll();
  }
}
