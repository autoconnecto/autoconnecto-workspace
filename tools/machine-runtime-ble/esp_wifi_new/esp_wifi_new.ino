// =============================================================
// esp_wifi_new — PZEM telemetry + electrical cycles_count + BLE bridge
//
// Pair with: tools/machine-runtime-ble/esp_ble/esp_ble.ino (unchanged)
// Contract:  sdk/MACHINE_RUNTIME_BLE.md + sdk/MACHINE_RUNTIME.md
//
// UART link (115200 8N1) — same pin map on BOTH boards:
//   TX=GPIO19  →  peer RX=GPIO21
//   RX=GPIO21  ←  peer TX=GPIO19
//   GND ↔ GND
//
// Sample PZEM + load FSM every SAMPLE_MS (~400 ms).
// Publish V/I/P (+ cycles_count) heartbeat every TELEMETRY_MS, and immediately on
// load phase change or full cycle complete — MQTT before NVS.
// CLIENT cycles_count attr still mirrored on cycle / reconnect / periodic push.
//
// Load FSM (hysteresis):
//   on_load  when current > 0.20 A
//   off_load when current < 0.16 A (20% below on-load threshold)
//   One cycle = off_load → on_load → off_load
//
// cycles_count: electrical load cycles (CLIENT attr + NVS)
// machine_cycle_count: worker session jobs (BLE app +/−)
//
// Hardware: PZEM UART2 RX=GPIO16, TX=GPIO17 | SSR GPIO 2
// Libraries: AutoconnectoSDK, ArduinoJson, Preferences
// Revert:    esp_wifi_new_backup/esp_wifi_new_backup.ino
// =============================================================

#include <WiFi.h>
#include <time.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <AutoconnectoSDK.h>

AutoconnectoSDK sdk;
Preferences prefs;

#define LINK_RX 21
#define LINK_TX 19
#define LINK_BAUD 115200
#define LINK_HELLO_MS 15000UL

#define PZEM_UART_RX 16
#define PZEM_UART_TX 17
#define PZEM_BAUD 9600
#define PZEM_SLAVE_ADDR 0xF8
#define PIN_SSR_ALLOW 2

/** PZEM + load-FSM sample rate (detection latency floor). */
#define SAMPLE_MS 400UL
/** Steady-state amps/voltage heartbeat when load is idle. */
#define TELEMETRY_MS 1000UL
#define SHARED_SYNC_MS 60000UL
#define CLIENT_PUSH_MS 30000UL
#define STATUS_PUSH_MS 2000UL

#define LOCAL_DEV 0

// Fleet Setup → Edit machine → Copy token (not Device ID)
static const char* DEVICE_TOKEN = "PASTE_DEVICE_TOKEN_HERE";

#if LOCAL_DEV
static const char* MQTT_HOST = "192.168.68.107";
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
#else
static const char* MQTT_HOST = "mqtt.autoconnecto.in";
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
#endif

#define SHARED_ATTR_KEYS \
  "machine_slot,machine_code,machine_allow_run,machine_tool_remaining,machine_tool_limit,machine_tool_cycles_used"

#define NVS_RUNTIME_VERSION 2

static const char* KEY_CURRENT = "current_current";
static const char* KEY_VOLTAGE = "current_voltage";
static const char* KEY_POWER = "current_power";
static const char* KEY_SENSOR_OK = "machine_sensor_ok";
static const char* KEY_OPERATOR_ID = "machine_operator_id";
static const char* KEY_OPERATOR_NAME = "machine_operator_name";
static const char* KEY_SESSION_ACTIVE = "machine_session_active";
static const char* KEY_SESSION_START_TS = "machine_session_start_ts";
static const char* KEY_SESSION_END_TS = "machine_session_end_ts";
static const char* KEY_JOB_COUNT = "machine_cycle_count";
static const char* KEY_SESSION_JOBS_CLOSED = "machine_session_jobs_closed";
static const char* ATTR_CYCLES_COUNT = "cycles_count";
static const char* ATTR_ALLOW_RUN = "machine_allow_run";
static const char* ATTR_MACHINE_SLOT = "machine_slot";
static const char* ATTR_MACHINE_CODE = "machine_code";
static const char* ATTR_TOOL_REMAINING = "machine_tool_remaining";
static const char* ATTR_TOOL_LIMIT = "machine_tool_limit";
static const char* ATTR_TOOL_USED = "machine_tool_cycles_used";

/** On-load when current rises above this (A). */
static const float ON_LOAD_A = 0.20f;
/** Off-load when current falls below on_load − 20% (A). */
static const float OFF_LOAD_A = ON_LOAD_A * 0.80f;

enum class LoadPhase : uint8_t { OffLoad, OnLoad };

HardwareSerial LinkSerial(1);
HardwareSerial PzemSerial(2);

struct PzemReading {
  float voltageV;
  float currentA;
  float powerW;
};

static bool linkPeerAlive = false;
static unsigned long linkLastRxMs = 0;
static uint32_t linkRxByteCount = 0;

static bool allowRun = true;
static bool sessionActive = false;
static String operatorId = "";
static String operatorName = "";
static int machineSlot = 0;
static String machineCode = "";
static int jobCount = 0;
static long sessionStartTs = 0;
static long sessionEndTs = 0;
static int toolRemaining = -1;
static int toolLimit = -1;
static int toolUsed = -1;
static int sessionJobsClosedPulse = -1;

static bool pendingPersistNvs = false;
static bool pendingClientMirrorOnConnect = false;
static bool pendingBootAttrSync = false;
static bool pendingCyclesMirror = false;
static bool sharedAttrsReceived = false;
static volatile bool mqttUp = false;

static unsigned long lastSampleMs = 0;
static unsigned long lastTelemetryMs = 0;
static unsigned long lastSharedSyncMs = 0;
static unsigned long lastClientPushMs = 0;
static unsigned long lastStatusPushMs = 0;
static unsigned long lastStatusDirtyMs = 0;
static unsigned long deferredStatusPushMs = 0;
static bool statusDirty = true;

static LoadPhase loadPhase = LoadPhase::OffLoad;
static uint32_t cyclesCount = 0;
/** Last cycles_count pushed as CLIENT attr (avoid spam). */
static uint32_t lastPublishedCyclesCount = UINT32_MAX;

enum class LoadEvent : uint8_t { None, PhaseChanged, CycleCompleted };

static void persistCyclesCount() {
  prefs.putUInt("cycles_count", cyclesCount);
}

static void loadCyclesCountFromNvs() {
  cyclesCount = prefs.getUInt("cycles_count", 0);
}

static void persistRuntimeToNvs() {
  prefs.putInt("nv_ver", NVS_RUNTIME_VERSION);
  prefs.putInt("session_active", sessionActive ? 1 : 0);
  prefs.putString("operator_id", operatorId);
  prefs.putString("operator_name", operatorName);
  prefs.putLong("session_start_ts", sessionStartTs);
  prefs.putLong("session_end_ts", sessionEndTs);
  prefs.putInt("allow_run", allowRun ? 1 : 0);
  prefs.putInt("job_count", jobCount);
  prefs.putInt("machine_slot", machineSlot);
  prefs.putString("machine_code", machineCode);
  prefs.putInt("tool_rem", toolRemaining);
  prefs.putInt("tool_limit", toolLimit);
  prefs.putInt("tool_used", toolUsed);
}

static void loadRuntimeFromNvs() {
  machineSlot = prefs.getInt("machine_slot", 0);
  machineCode = prefs.getString("machine_code", "");
  jobCount = prefs.getInt("job_count", 0);
  sessionActive = prefs.getInt("session_active", 0) == 1;
  operatorId = prefs.getString("operator_id", "");
  operatorName = prefs.getString("operator_name", "");
  sessionStartTs = prefs.getLong("session_start_ts", 0);
  sessionEndTs = prefs.getLong("session_end_ts", 0);
  allowRun = prefs.getInt("allow_run", 1) == 1;
  toolRemaining = prefs.getInt("tool_rem", -1);
  toolLimit = prefs.getInt("tool_limit", -1);
  toolUsed = prefs.getInt("tool_used", -1);

  if (!sessionActive && jobCount != 0) {
    jobCount = 0;
    prefs.putInt("job_count", 0);
  }
}

static void requestPersistNvs() {
  pendingPersistNvs = true;
}

static void flushPersistNvs() {
  if (!pendingPersistNvs) return;
  pendingPersistNvs = false;
  persistRuntimeToNvs();
}

static void applySsrOutput() {
  const bool ssrOn = sessionActive && allowRun;
  static bool lastSsrOn = false;
  digitalWrite(PIN_SSR_ALLOW, ssrOn ? HIGH : LOW);
  if (ssrOn != lastSsrOn) {
    lastSsrOn = ssrOn;
    Serial.print("[SSR] ");
    Serial.print(ssrOn ? "ON" : "OFF");
    Serial.print(" (session=");
    Serial.print(sessionActive ? "1" : "0");
    Serial.print(" allow_run=");
    Serial.print(allowRun ? "1" : "0");
    Serial.println(")");
  }
}

static long nowEpochSec() {
  const time_t t = time(nullptr);
  return (t > 1700000000L) ? (long)t : 0;
}

static bool isMqttUp() {
  return mqttUp;
}

static void markStatusDirty() {
  statusDirty = true;
  lastStatusDirtyMs = millis();
}

static void initLinkUart() {
  LinkSerial.end();
  delay(20);
  LinkSerial.begin(LINK_BAUD, SERIAL_8N1, LINK_RX, LINK_TX);
  while (LinkSerial.available()) LinkSerial.read();
  Serial.printf("[LINK] Serial1 RX=GPIO%d TX=GPIO%d\n", LINK_RX, LINK_TX);
}

static void linkSendLine(const char* line) {
  LinkSerial.print(line);
  LinkSerial.print('\n');
  LinkSerial.flush();
}

static void pushStatusToBle(bool sessionBusy = false) {
  StaticJsonDocument<512> doc;
  doc["type"] = "status";
  doc["slot"] = machineSlot;
  if (machineCode.length()) doc["code"] = machineCode;
  doc["session"] = sessionActive;
  doc["jobs"] = jobCount;
  doc["allow_run"] = allowRun;
  if (toolRemaining >= 0) {
    doc["tool_remaining"] = toolRemaining;
    doc["tool_life_enabled"] = true;
  } else {
    doc["tool_life_enabled"] = false;
  }
  if (toolLimit >= 0) doc["tool_limit"] = toolLimit;
  if (sessionBusy) doc["session_busy"] = true;
  if (sessionStartTs > 0) doc["session_start_ts"] = sessionStartTs;
  if (sessionEndTs > 0) doc["session_end_ts"] = sessionEndTs;
  if (operatorId.length()) doc["operator_id"] = operatorId;
  if (operatorName.length()) doc["operator_name"] = operatorName;

  char buf[512];
  const size_t n = serializeJson(doc, buf, sizeof(buf));
  if (!n) return;
  Serial.print("[LINK] → ");
  Serial.println(buf);
  linkSendLine(buf);
  statusDirty = false;
}

static void pushClientMirror(bool pushOperatorTelemetry = false) {
  StaticJsonDocument<512> attrs;
  attrs[ATTR_CYCLES_COUNT] = (float)cyclesCount;
  attrs[ATTR_ALLOW_RUN] = allowRun;
  attrs[KEY_SESSION_ACTIVE] = sessionActive;
  if (operatorId.length()) attrs[KEY_OPERATOR_ID] = operatorId;
  if (operatorName.length()) attrs[KEY_OPERATOR_NAME] = operatorName;
  // Do not mirror machine_slot as CLIENT — SHARED from platform is source of truth.
  attrs[KEY_JOB_COUNT] = jobCount;
  attrs[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
  attrs[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
  if (toolRemaining >= 0) attrs[ATTR_TOOL_REMAINING] = toolRemaining;
  if (toolLimit >= 0) attrs[ATTR_TOOL_LIMIT] = toolLimit;
  if (toolUsed >= 0) attrs[ATTR_TOOL_USED] = toolUsed;
  sdk.sendClientAttributes(attrs);
  lastPublishedCyclesCount = cyclesCount;

  if (pushOperatorTelemetry) {
    StaticJsonDocument<320> tel;
    tel[KEY_OPERATOR_ID] = operatorId;
    tel[KEY_OPERATOR_NAME] = operatorName;
    tel[KEY_SESSION_ACTIVE] = sessionActive;
    tel[KEY_JOB_COUNT] = jobCount;
    tel[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
    tel[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
    if (sessionJobsClosedPulse >= 0) {
      tel[KEY_SESSION_JOBS_CLOSED] = sessionJobsClosedPulse;
      sessionJobsClosedPulse = -1;
    }
    sdk.sendTelemetry(tel);
  }
}

static void publishCyclesCountClient(bool force = false) {
  if (!sdk.connected()) return;
  if (!force && cyclesCount == lastPublishedCyclesCount) return;
  sdk.sendClientAttribute(ATTR_CYCLES_COUNT, (float)cyclesCount);
  lastPublishedCyclesCount = cyclesCount;
}

/** Publish live electrical sample. Always includes cycles_count so the
 *  platform telemetry path can update without waiting on CLIENT attrs. */
static void publishElectricalTelemetry(
  const PzemReading& pzem,
  bool sensorOk,
  float currentA
) {
  StaticJsonDocument<256> tel;
  tel[KEY_CURRENT] = currentA;
  tel[KEY_VOLTAGE] = sensorOk ? pzem.voltageV : 0.0f;
  tel[KEY_POWER] = sensorOk ? pzem.powerW : 0.0f;
  tel[KEY_SENSOR_OK] = sensorOk;
  tel[ATTR_CYCLES_COUNT] = (float)cyclesCount;
  sdk.sendTelemetry(tel);
}

static void resetSessionJobs() {
  jobCount = 0;
  prefs.putInt("job_count", 0);
}

static void endSession(const char* reason) {
  if (strcmp(reason, "stop") != 0) {
    Serial.print("[SESSION] end ignored: ");
    Serial.println(reason);
    return;
  }
  sessionJobsClosedPulse = jobCount;
  sessionActive = false;
  operatorId = "";
  operatorName = "";
  resetSessionJobs();
  const long endedAt = nowEpochSec();
  if (endedAt > 0) sessionEndTs = endedAt;
  applySsrOutput();
  requestPersistNvs();
  pushClientMirror(true);
  markStatusDirty();
  pushStatusToBle();
  Serial.println("[SESSION] end (app stop)");
}

static void startSession(const String& id, const String& name) {
  if (!allowRun) {
    markStatusDirty();
    pushStatusToBle();
    return;
  }
  if (sessionActive && operatorId.length() && operatorId != id) {
    Serial.print("[SESSION] busy — ");
    Serial.println(operatorId);
    pushStatusToBle(true);
    return;
  }
  if (sessionActive && operatorId == id) {
    // Treat an explicit "start" as a new shift boundary even for same operator.
    // This avoids stale session_start_ts when the mobile app reconnects or retries.
    resetSessionJobs();
    operatorName = name.length() ? name : id;
    sessionActive = true;
    sessionEndTs = 0;
    const long startedAt = nowEpochSec();
    // If NTP isn't ready yet, clear start_ts so UI doesn't show a stale old value.
    // We'll back-fill once time is available.
    sessionStartTs = startedAt > 0 ? startedAt : 0;
    applySsrOutput();
    requestPersistNvs();
    pushClientMirror(true);
    markStatusDirty();
    pushStatusToBle();
    Serial.println("[SESSION] restart same operator");
    return;
  }
  resetSessionJobs();
  operatorId = id;
  operatorName = name.length() ? name : id;
  sessionActive = true;
  sessionEndTs = 0;
  const long startedAt = nowEpochSec();
  sessionStartTs = startedAt > 0 ? startedAt : 0;
  applySsrOutput();
  requestPersistNvs();
  pushClientMirror(true);
  markStatusDirty();
  pushStatusToBle();
  Serial.print("[SESSION] start ");
  Serial.println(operatorId);
}

static void reconcileToolLifeFromShared() {
  if (toolLimit <= 0 || toolRemaining < 0) return;
  const int used = toolUsed >= 0 ? toolUsed : 0;
  toolRemaining = toolLimit - used;
  if (toolRemaining < 0) toolRemaining = 0;
  if (toolRemaining == 0) {
    allowRun = false;
  } else {
    allowRun = true;
  }
  applySsrOutput();
}

static void afterToolLifeSharedUpdate() {
  applySsrOutput();
  requestPersistNvs();
  markStatusDirty();
  pushStatusToBle();
}

static void adjustJobCount(int delta) {
  if (!sessionActive) return;
  if (delta < 0 && jobCount <= 0) return;

  if (delta > 0) {
    if (!allowRun) {
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] job_add blocked (allow_run off)");
      return;
    }
    if (toolRemaining >= 0 && toolRemaining <= 0) {
      allowRun = false;
      applySsrOutput();
      pushClientMirror(false);
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] job_add blocked (tool life exhausted)");
      return;
    }
  }

  jobCount += delta;
  if (jobCount < 0) jobCount = 0;
  prefs.putInt("job_count", jobCount);
  if (toolUsed >= 0 && delta > 0) toolUsed += delta;
  if (toolRemaining >= 0 && delta > 0) {
    toolRemaining -= delta;
    if (toolRemaining <= 0) {
      toolRemaining = 0;
      allowRun = false;
      applySsrOutput();
      requestPersistNvs();
      pushClientMirror(true);
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] tool life exhausted — SSR OFF, session stays ON");
      return;
    }
  }
  requestPersistNvs();
  pushClientMirror(true);
  markStatusDirty();
  pushStatusToBle();
  Serial.print("[SESSION] jobs=");
  Serial.println(jobCount);
}

static void linkSendHello() {
  Serial.println("[LINK] → {\"type\":\"hello\",\"board\":\"wifi\"}");
  linkSendLine("{\"type\":\"hello\",\"board\":\"wifi\"}");
}

static void requestPlatformSync(const char* reason) {
  if (!isMqttUp()) return;
  Serial.print("[SYNC] ");
  Serial.println(reason);
  sdk.requestSharedAttributes(SHARED_ATTR_KEYS);
}

static void handleWorkerCommand(const String& line) {
  if (!line.length() || !line.startsWith("{")) return;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, line)) {
    Serial.println("[LINK] bad JSON");
    return;
  }

  const char* type = doc["type"] | "";
  if (!strcmp(type, "hello") && !strcmp(doc["board"] | "", "ble")) {
    Serial.println("[LINK] esp_ble peer OK");
    pushStatusToBle();
    return;
  }

  const char* cmd = doc["cmd"] | "";
  if (!strcmp(cmd, "get_status")) {
    pushStatusToBle();
    return;
  }
  if (!strcmp(cmd, "heartbeat")) {
    markStatusDirty();
    pushStatusToBle();
    return;
  }
  if (!strcmp(cmd, "sync_attrs")) {
    requestPlatformSync("worker_app");
    deferredStatusPushMs = millis() + 900;
    return;
  }
  if (!strcmp(cmd, "start")) {
    const char* id = doc["operator_id"] | "";
    const char* opName = doc["operator_name"] | "";
    if (!id[0]) return;
    startSession(String(id), String(opName));
    return;
  }
  if (!strcmp(cmd, "stop")) {
    endSession("stop");
    return;
  }
  if (!strcmp(cmd, "job_add")) {
    adjustJobCount(1);
    return;
  }
  if (!strcmp(cmd, "job_remove")) {
    adjustJobCount(-1);
    return;
  }
}

static void pollLinkRx() {
  while (LinkSerial.available()) {
    String line = LinkSerial.readStringUntil('\n');
    line.trim();
    if (!line.length()) continue;
    linkRxByteCount += line.length();
    linkPeerAlive = true;
    linkLastRxMs = millis();

    Serial.print("[LINK] ← ");
    Serial.println(line);

    if (line == "PING") {
      linkSendLine("PONG");
      continue;
    }
    if (line == "PONG") continue;
    if (!line.startsWith("{")) continue;

    handleWorkerCommand(line);
  }
}

static void onSharedAttribute(const String& key, float value) {
  sharedAttrsReceived = true;

  if (key == ATTR_ALLOW_RUN) {
    const bool platformAllow = value >= 0.5f;
    if (platformAllow && toolRemaining == 0 && toolLimit > 0) {
      const int used = toolUsed >= 0 ? toolUsed : 0;
      if (used >= toolLimit) {
        Serial.println("[ATTR] ignore stale allow_run=true while tool exhausted");
        return;
      }
    }
    allowRun = platformAllow;
    applySsrOutput();
    requestPersistNvs();
    markStatusDirty();
    return;
  }
  if (key == ATTR_MACHINE_SLOT) {
    const int slot = (int)value;
    Serial.print("[ATTR] machine_slot=");
    Serial.print(value);
    Serial.print(" -> ");
    Serial.println(slot);
    if (slot > 0 && slot != machineSlot) {
      Serial.print("[ATTR] slot change ");
      Serial.print(machineSlot);
      Serial.print(" → ");
      Serial.println(slot);
      machineSlot = slot;
      requestPersistNvs();
      // Push to BLE immediately so advert becomes AC-### without waiting for poll.
      pushStatusToBle();
    } else if (slot > 0) {
      machineSlot = slot;
      requestPersistNvs();
      markStatusDirty();
    }
    return;
  }
  if (key == ATTR_TOOL_REMAINING) {
    toolRemaining = (int)value;
    if (toolRemaining > 0) {
      allowRun = true;
    } else if (toolRemaining == 0 && toolLimit > 0) {
      allowRun = false;
    }
    afterToolLifeSharedUpdate();
    return;
  }
  if (key == ATTR_TOOL_LIMIT) {
    toolLimit = (int)value;
    reconcileToolLifeFromShared();
    afterToolLifeSharedUpdate();
    return;
  }
  if (key == ATTR_TOOL_USED) {
    toolUsed = (int)value;
    reconcileToolLifeFromShared();
    afterToolLifeSharedUpdate();
  }
}

static void onSharedAttributeString(const String& key, const String& value) {
  if (key != ATTR_MACHINE_CODE) return;
  sharedAttrsReceived = true;
  String next = value;
  next.trim();
  if (!next.length()) return;
  if (next == machineCode) return;
  Serial.print("[ATTR] machine_code=");
  Serial.println(next);
  machineCode = next;
  requestPersistNvs();
  pushStatusToBle();
}

static void onMqttConnect(bool connected) {
  if (connected) {
    sharedAttrsReceived = false;
    pendingBootAttrSync = true;
    pendingClientMirrorOnConnect = true;
    pendingCyclesMirror = true;
  }
}

/** Advance load FSM; report phase edge or completed off→on→off cycle. */
static LoadEvent advanceLoadCycleFsm(float currentA, bool sensorOk) {
  if (!sensorOk) return LoadEvent::None;

  if (loadPhase == LoadPhase::OffLoad) {
    if (currentA > ON_LOAD_A) {
      loadPhase = LoadPhase::OnLoad;
      return LoadEvent::PhaseChanged;
    }
    return LoadEvent::None;
  }

  if (currentA < OFF_LOAD_A) {
    loadPhase = LoadPhase::OffLoad;
    cyclesCount++;
    // Persist after MQTT publish (NVS can stall the publish path).
    return LoadEvent::CycleCompleted;
  }
  return LoadEvent::None;
}

static const char* loadPhaseLabel() {
  return loadPhase == LoadPhase::OnLoad ? "on_load" : "off_load";
}

static void connectWifiAndSyncTime() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(WIFI_PS_NONE);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] connecting");
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] failed");
    return;
  }
  Serial.print("[WiFi] IP ");
  Serial.println(WiFi.localIP());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  for (int i = 0; i < 40; i++) {
    if (time(nullptr) > 1700000000L) {
      Serial.println("[NTP] synced");
      return;
    }
    delay(500);
  }
}

static uint16_t modbusCRC(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
    }
  }
  return crc;
}

static bool modbusReadInputRegs(uint8_t slave, uint16_t startReg, uint16_t count, uint16_t* out) {
  if (!count || count > 32) return false;
  uint8_t req[8];
  req[0] = slave;
  req[1] = 0x04;
  req[2] = (uint8_t)(startReg >> 8);
  req[3] = (uint8_t)(startReg & 0xFF);
  req[4] = (uint8_t)(count >> 8);
  req[5] = (uint8_t)(count & 0xFF);
  const uint16_t crc = modbusCRC(req, 6);
  req[6] = (uint8_t)(crc & 0xFF);
  req[7] = (uint8_t)(crc >> 8);
  while (PzemSerial.available()) PzemSerial.read();
  PzemSerial.write(req, 8);
  PzemSerial.flush();
  const unsigned long deadline = millis() + 500;
  size_t idx = 0;
  uint8_t resp[128];
  const size_t expected = 5 + count * 2;
  while (millis() < deadline && idx < expected && idx < sizeof(resp)) {
    delay(1);
    if (PzemSerial.available()) resp[idx++] = (uint8_t)PzemSerial.read();
  }
  if (idx < 5 || resp[0] != slave || resp[1] != 0x04) return false;
  const uint8_t byteCount = resp[2];
  if (idx < (size_t)(3 + byteCount + 2)) return false;
  if (modbusCRC(resp, 3 + byteCount) != ((uint16_t)resp[3 + byteCount] | ((uint16_t)resp[4 + byteCount] << 8))) {
    return false;
  }
  for (uint16_t i = 0; i < count; i++) {
    out[i] = ((uint16_t)resp[3 + i * 2] << 8) | resp[4 + i * 2];
  }
  return true;
}

static bool readPZEM(PzemReading& out) {
  uint16_t regs[10] = {0};
  if (!modbusReadInputRegs(PZEM_SLAVE_ADDR, 0x0000, 10, regs)) return false;
  out.voltageV = regs[0] / 10.0f;
  const uint32_t currentRaw = ((uint32_t)regs[2] << 16) | regs[1];
  out.currentA = currentRaw / 1000.0f;
  const uint32_t powerRaw = ((uint32_t)regs[4] << 16) | regs[3];
  out.powerW = powerRaw / 10.0f;
  return out.voltageV >= 0.0f && out.voltageV <= 320.0f &&
         out.currentA >= 0.0f && out.currentA < 120.0f;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("[BOOT] esp_wifi_new — PZEM + cycles_count + BLE link");

  prefs.begin("ac_wifi_new", false);
  loadCyclesCountFromNvs();
  loadRuntimeFromNvs();
  Serial.print("[NV] cycles_count=");
  Serial.print(cyclesCount);
  Serial.print(" session=");
  Serial.print(sessionActive ? "1" : "0");
  Serial.print(" jobs=");
  Serial.println(jobCount);

  pinMode(PIN_SSR_ALLOW, OUTPUT);
  applySsrOutput();

  LinkSerial.begin(LINK_BAUD, SERIAL_8N1, LINK_RX, LINK_TX);
  pinMode(LINK_RX, INPUT_PULLUP);
  delay(100);
  Serial.printf("[LINK] UART RX=GPIO%d TX=GPIO%d baud=%d\n", LINK_RX, LINK_TX, LINK_BAUD);
  Serial.println("[LINK] wire: this TX19→peer RX21, this RX21←peer TX19, GND");

  PzemSerial.begin(PZEM_BAUD, SERIAL_8N1, PZEM_UART_RX, PZEM_UART_TX);

  connectWifiAndSyncTime();
  delay(500);

  SDKConfig config;
  config.wifiSSID = WIFI_SSID;
  config.wifiPassword = WIFI_PASSWORD;
  config.mqttHost = MQTT_HOST;
  config.deviceToken = DEVICE_TOKEN;
  config.enableMQTT = true;
  config.sharedAttributeKeys = SHARED_ATTR_KEYS;
  config.enableSerialLogs = true;

#if LOCAL_DEV
  config.mqttPort = 1883;
  config.wssPort = 8083;
  config.enableWS = false;
  config.mqttUseTls = false;
  config.allowInsecureTLS = true;
  config.rootCA = nullptr;
  Serial.println("[CFG] LOCAL → mqtt://192.168.68.107:1883");
#else
  // Match Machine_Runtime_BLE_mqtt production (WSS is :8084, not :443).
  config.mqttPort = 8883;
  config.wssPort = 8084;
  config.enableWS = true;
  config.mqttUseTls = true;
  config.allowInsecureTLS = false;
  config.rootCA = AUTOCONNECTO_ROOT_CA;
  Serial.println("[CFG] PRODUCTION → wss://mqtt.autoconnecto.in:8084/mqtt");
#endif

  sdk.onAttributeUpdate(onSharedAttribute);
  sdk.onAttributeStringUpdate(onSharedAttributeString);
  sdk.onConnect(onMqttConnect);
  sdk.begin(config);
  Serial.println("[MQTT] sdk.begin()");

  initLinkUart();
  Serial.println("[LINK] UART reinit after WiFi/MQTT");

  linkSendHello();
  markStatusDirty();
  pushStatusToBle();
}

void loop() {
  sdk.loop();
  mqttUp = sdk.connected();

  pollLinkRx();
  flushPersistNvs();

  // If a session started before NTP sync, back-fill session_start_ts once time is available.
  if (sessionActive) {
    const long nowSec = nowEpochSec();
    if (sessionStartTs == 0 && nowSec > 0) {
      sessionStartTs = nowSec;
      requestPersistNvs();
      pushClientMirror(true);
      markStatusDirty();
      Serial.println("[SESSION] backfilled session_start_ts after NTP sync");
    } else if (sessionStartTs > 0 && nowSec > 0 && sessionStartTs > nowSec + 120) {
      // Bad NTP or stale NVS can leave a future start_ts; correct in place.
      sessionStartTs = nowSec;
      requestPersistNvs();
      pushClientMirror(true);
      markStatusDirty();
      Serial.println("[SESSION] corrected future session_start_ts");
    }
  }

  if (statusDirty && millis() - lastStatusDirtyMs >= 100) {
    pushStatusToBle();
  }
  if (deferredStatusPushMs > 0 && millis() >= deferredStatusPushMs) {
    deferredStatusPushMs = 0;
    pushStatusToBle();
  }

  if (pendingClientMirrorOnConnect && isMqttUp()) {
    pendingClientMirrorOnConnect = false;
    pushClientMirror(true);
  }
  if (pendingBootAttrSync && isMqttUp()) {
    pendingBootAttrSync = false;
    requestPlatformSync("mqtt_connect");
  }

  if (pendingCyclesMirror && isMqttUp()) {
    pendingCyclesMirror = false;
    publishCyclesCountClient(true);
  }

  const unsigned long nowMs = millis();
  if (nowMs - lastSharedSyncMs >= SHARED_SYNC_MS) {
    lastSharedSyncMs = nowMs;
    requestPlatformSync("periodic");
  }
  if (nowMs - lastClientPushMs >= CLIENT_PUSH_MS) {
    lastClientPushMs = nowMs;
    pushClientMirror(false);
  }
  if (nowMs - lastStatusPushMs >= STATUS_PUSH_MS && sessionActive) {
    lastStatusPushMs = nowMs;
    pushStatusToBle();
  }

  // Fast sample for cycle/load edges; slower heartbeat when idle.
  if (nowMs - lastSampleMs >= SAMPLE_MS) {
    lastSampleMs = nowMs;

    PzemReading pzem;
    const bool sensorOk = readPZEM(pzem);
    const float currentA = sensorOk ? pzem.currentA : 0.0f;
    const LoadEvent loadEvent = advanceLoadCycleFsm(currentA, sensorOk);
    const bool edge =
      loadEvent == LoadEvent::PhaseChanged ||
      loadEvent == LoadEvent::CycleCompleted;
    const bool heartbeat = nowMs - lastTelemetryMs >= TELEMETRY_MS;

    if (edge || heartbeat) {
      lastTelemetryMs = nowMs;
      // MQTT first — cycle count must not wait on NVS or CLIENT-attr DB path.
      publishElectricalTelemetry(pzem, sensorOk, currentA);

      if (loadEvent == LoadEvent::CycleCompleted) {
        publishCyclesCountClient(true);
        persistCyclesCount();
      }

      Serial.print("[PZEM] V=");
      Serial.print(pzem.voltageV, 1);
      Serial.print(" I=");
      Serial.print(currentA, 3);
      Serial.print(" P=");
      Serial.print(pzem.powerW, 1);
      Serial.print(" phase=");
      Serial.print(loadPhaseLabel());
      Serial.print(" cycles=");
      Serial.print(cyclesCount);
      if (loadEvent == LoadEvent::CycleCompleted) Serial.print(" +1");
      else if (loadEvent == LoadEvent::PhaseChanged) Serial.print(" edge");
      Serial.print(" jobs=");
      Serial.print(jobCount);
      Serial.print(" mqtt=");
      Serial.println(isMqttUp() ? "up" : "down");
    }
  }

  if (!linkPeerAlive && nowMs > LINK_HELLO_MS) {
    static unsigned long lastHelloMs = 0;
    if (nowMs - lastHelloMs >= 2000UL) {
      lastHelloMs = nowMs;
      initLinkUart();
      linkSendHello();
      pushStatusToBle();
      Serial.print("[LINK] waiting esp_ble link_rx=");
      Serial.print(linkRxByteCount);
      Serial.println(" — both boards must be ON at same time");
    }
  }

  delay(1);
}
