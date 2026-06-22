// =============================================================
// esp_wifi — WiFi / MQTT / PZEM / SSR (session owner)
//
// Pair with: tools/machine-runtime-ble/esp_ble/esp_ble.ino
// Contract:  sdk/MACHINE_RUNTIME_BLE.md + sdk/MACHINE_RUNTIME.md
//
// UART link (115200 8N1) — same pin map on BOTH boards:
//   TX=GPIO19  →  peer RX=GPIO21
//   RX=GPIO21  ←  peer TX=GPIO19
//   GND ↔ GND
//
// PZEM UART2: RX=16 TX=17 | SSR GPIO 2
//
// Libraries: AutoconnectoSDK, ArduinoJson
// Partition: Huge APP (3MB No OTA) recommended
// =============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <AutoconnectoSDK.h>

AutoconnectoSDK sdk;

#define LINK_RX 21
#define LINK_TX 19
#define LINK_BAUD 115200
#define LINK_LINE_MAX 512
#define LINK_HELLO_MS 15000UL

static bool linkPeerAlive = false;
static unsigned long linkLastRxMs = 0;
static uint32_t linkRxByteCount = 0;

#define PZEM_UART_RX 16
#define PZEM_UART_TX 17
#define PZEM_BAUD 9600
#define PZEM_SLAVE_ADDR 0xF8
#define PZEM_DEMO_FALLBACK 0
#define PZEM_RAW_DEBUG 0
#define PIN_SSR_ALLOW 2

#define SHARED_SYNC_MS 60000UL
#define CLIENT_PUSH_MS 30000UL
#define TELEMETRY_MS 10000UL
#define STATUS_PUSH_MS 2000UL

#define LOCAL_DEV 1
#define HTTP_ATTR_FALLBACK 0

static const char* DEVICE_TOKEN = "1047388e-d0d7-44a3-98c7-9258ba977add";

#if LOCAL_DEV
static const char* MQTT_HOST = "192.168.68.107";
#else
static const char* MQTT_HOST = "mqtt.autoconnecto.in";
#endif

#define SHARED_ATTR_KEYS \
  "machine_slot,machine_allow_run,machine_tool_remaining,machine_tool_limit,machine_tool_cycles_used"

#define NVS_RUNTIME_VERSION 2

const char* KEY_CURRENT = "machine_current_a";
const char* KEY_VOLTAGE = "machine_voltage_v";
const char* KEY_POWER = "machine_power_w";
const char* KEY_SENSOR_OK = "machine_sensor_ok";
const char* KEY_OPERATOR_ID = "machine_operator_id";
const char* KEY_OPERATOR_NAME = "machine_operator_name";
const char* KEY_SESSION_ACTIVE = "machine_session_active";
const char* KEY_SESSION_START_TS = "machine_session_start_ts";
const char* KEY_SESSION_END_TS = "machine_session_end_ts";
const char* KEY_CYCLE_COUNT = "machine_cycle_count";
const char* KEY_SESSION_JOBS_CLOSED = "machine_session_jobs_closed";

static int sessionJobsClosedPulse = -1;
const char* ATTR_ALLOW_RUN = "machine_allow_run";
const char* ATTR_MACHINE_SLOT = "machine_slot";
const char* ATTR_TOOL_REMAINING = "machine_tool_remaining";
const char* ATTR_TOOL_LIMIT = "machine_tool_limit";
const char* ATTR_TOOL_USED = "machine_tool_cycles_used";

HardwareSerial LinkSerial(1);
HardwareSerial PzemSerial(2);
Preferences prefs;

static bool allowRun = true;
static bool sessionActive = false;
static String operatorId = "";
static String operatorName = "";
static int machineSlot = 0;
static int cycleCount = 0;
static long sessionStartTs = 0;
static long sessionEndTs = 0;
static int toolRemaining = -1;
static int toolLimit = -1;
static int toolUsed = -1;

static bool pendingPersistNvs = false;
static bool pendingClientMirrorOnConnect = false;
static bool pendingBootAttrSync = false;
static bool pendingSlotClientAttr = false;
static bool sharedAttrsReceived = false;
static volatile bool mqttUp = false;

static unsigned long lastStatusPushMs = 0;
static unsigned long lastStatusDirtyMs = 0;
static bool statusDirty = true;

struct PzemReading {
  float voltageV;
  float currentA;
  float powerW;
  float frequencyHz;
  float powerFactor;
};

static void persistRuntimeToNvs() {
  prefs.putInt("nv_ver", NVS_RUNTIME_VERSION);
  prefs.putInt("session_active", sessionActive ? 1 : 0);
  prefs.putString("operator_id", operatorId);
  prefs.putString("operator_name", operatorName);
  prefs.putLong("session_start_ts", sessionStartTs);
  prefs.putLong("session_end_ts", sessionEndTs);
  prefs.putInt("allow_run", allowRun ? 1 : 0);
  prefs.putInt("cycle_count", cycleCount);
  prefs.putInt("machine_slot", machineSlot);
  prefs.putInt("tool_rem", toolRemaining);
  prefs.putInt("tool_limit", toolLimit);
  prefs.putInt("tool_used", toolUsed);
}

static void loadRuntimeFromNvs() {
  machineSlot = prefs.getInt("machine_slot", 0);
  cycleCount = prefs.getInt("cycle_count", 0);
  sessionActive = prefs.getInt("session_active", 0) == 1;
  operatorId = prefs.getString("operator_id", "");
  operatorName = prefs.getString("operator_name", "");
  sessionStartTs = prefs.getLong("session_start_ts", 0);
  sessionEndTs = prefs.getLong("session_end_ts", 0);
  allowRun = prefs.getInt("allow_run", 1) == 1;
  toolRemaining = prefs.getInt("tool_rem", -1);
  toolLimit = prefs.getInt("tool_limit", -1);
  toolUsed = prefs.getInt("tool_used", -1);

  if (!sessionActive && cycleCount != 0) {
    cycleCount = 0;
    prefs.putInt("cycle_count", 0);
  }

  Serial.print("[NV] slot=");
  Serial.print(machineSlot);
  Serial.print(" session=");
  Serial.print(sessionActive ? "1" : "0");
  Serial.print(" jobs=");
  Serial.println(cycleCount);
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
  digitalWrite(PIN_SSR_ALLOW, sessionActive ? HIGH : LOW);
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
  Serial.printf("[LINK] Serial1 RX=GPIO%d TX=GPIO%d (same as link_test)\n", LINK_RX, LINK_TX);
}

static void linkSendLine(const char* line) {
  LinkSerial.print(line);
  LinkSerial.print('\n');
  LinkSerial.flush();
}

static void pushStatusToBle(bool sessionBusy = false) {
  StaticJsonDocument<384> doc;
  doc["type"] = "status";
  doc["slot"] = machineSlot;
  doc["session"] = sessionActive;
  doc["jobs"] = cycleCount;
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

  char buf[384];
  const size_t n = serializeJson(doc, buf, sizeof(buf));
  if (!n) return;
  Serial.print("[LINK] → ");
  Serial.println(buf);
  linkSendLine(buf);
  statusDirty = false;
}

static void pushClientMirror(bool pushOperatorTelemetry = false) {
  StaticJsonDocument<448> attrs;
  attrs[ATTR_ALLOW_RUN] = allowRun;
  attrs[KEY_SESSION_ACTIVE] = sessionActive;
  if (operatorId.length()) attrs[KEY_OPERATOR_ID] = operatorId;
  if (operatorName.length()) attrs[KEY_OPERATOR_NAME] = operatorName;
  if (machineSlot > 0) attrs[ATTR_MACHINE_SLOT] = machineSlot;
  attrs[KEY_CYCLE_COUNT] = cycleCount;
  attrs[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
  attrs[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
  if (toolRemaining >= 0) attrs[ATTR_TOOL_REMAINING] = toolRemaining;
  if (toolLimit >= 0) attrs[ATTR_TOOL_LIMIT] = toolLimit;
  if (toolUsed >= 0) attrs[ATTR_TOOL_USED] = toolUsed;
  sdk.sendClientAttributes(attrs);

  if (pushOperatorTelemetry) {
    StaticJsonDocument<320> tel;
    tel[KEY_OPERATOR_ID] = operatorId;
    tel[KEY_OPERATOR_NAME] = operatorName;
    tel[KEY_SESSION_ACTIVE] = sessionActive;
    tel[KEY_CYCLE_COUNT] = cycleCount;
    tel[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
    tel[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
    if (sessionJobsClosedPulse >= 0) {
      tel[KEY_SESSION_JOBS_CLOSED] = sessionJobsClosedPulse;
      sessionJobsClosedPulse = -1;
    }
    sdk.sendTelemetry(tel);
  }
}

static void resetSessionJobs() {
  cycleCount = 0;
  prefs.putInt("cycle_count", 0);
}

static void endSession(const char* reason) {
  if (strcmp(reason, "stop") != 0) {
    Serial.print("[SESSION] end ignored: ");
    Serial.println(reason);
    return;
  }
  sessionJobsClosedPulse = cycleCount;
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
    markStatusDirty();
    pushStatusToBle();
    Serial.println("[SESSION] resume same operator");
    return;
  }
  resetSessionJobs();
  operatorId = id;
  operatorName = name.length() ? name : id;
  sessionActive = true;
  sessionEndTs = 0;
  const long startedAt = nowEpochSec();
  if (startedAt > 0) sessionStartTs = startedAt;
  applySsrOutput();
  requestPersistNvs();
  pushClientMirror(true);
  markStatusDirty();
  pushStatusToBle();
  Serial.print("[SESSION] start ");
  Serial.println(operatorId);
}

static void reconcileToolLifeFromShared() {
  if (toolLimit > 0 && toolRemaining < 0) {
    const int used = toolUsed >= 0 ? toolUsed : 0;
    toolRemaining = toolLimit - used;
    if (toolRemaining < 0) toolRemaining = 0;
  }
  if (toolRemaining == 0) {
    allowRun = false;
  }
}

static void adjustJobCount(int delta) {
  if (!sessionActive) return;
  if (delta < 0 && cycleCount <= 0) return;

  if (delta > 0) {
    if (!allowRun) {
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] job_add blocked (allow_run off)");
      return;
    }
    if (toolRemaining >= 0 && toolRemaining <= 0) {
      allowRun = false;
      pushClientMirror(false);
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] job_add blocked (tool life exhausted)");
      return;
    }
  }

  cycleCount += delta;
  if (cycleCount < 0) cycleCount = 0;
  prefs.putInt("cycle_count", cycleCount);
  if (toolUsed >= 0 && delta > 0) toolUsed += delta;
  if (toolRemaining >= 0 && delta > 0) {
    toolRemaining -= delta;
    if (toolRemaining <= 0) {
      toolRemaining = 0;
      allowRun = false;
      requestPersistNvs();
      pushClientMirror(true);
      markStatusDirty();
      pushStatusToBle();
      Serial.println("[SESSION] tool life exhausted");
      return;
    }
  }
  requestPersistNvs();
  pushClientMirror(true);
  markStatusDirty();
  pushStatusToBle();
  Serial.print("[SESSION] jobs=");
  Serial.println(cycleCount);
}

static void linkSendHello() {
  Serial.println("[LINK] → {\"type\":\"hello\",\"board\":\"wifi\"}");
  linkSendLine("{\"type\":\"hello\",\"board\":\"wifi\"}");
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
    pushStatusToBle();
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

static void requestPlatformSync(const char* reason) {
  if (!isMqttUp()) return;
  Serial.print("[SYNC] ");
  Serial.println(reason);
  sdk.requestSharedAttributes(SHARED_ATTR_KEYS);
}

static void onSharedAttribute(const String& key, float value) {
  if (key == "machine_code") return;
  sharedAttrsReceived = true;

  if (key == ATTR_ALLOW_RUN) {
    allowRun = value >= 0.5f;
    requestPersistNvs();
    markStatusDirty();
    return;
  }
  if (key == ATTR_MACHINE_SLOT) {
    const int slot = (int)value;
    if (slot > 0) machineSlot = slot;
    pendingSlotClientAttr = true;
    requestPersistNvs();
    markStatusDirty();
    return;
  }
  if (key == ATTR_TOOL_REMAINING) {
    toolRemaining = (int)value;
    if (toolRemaining == 0) allowRun = false;
    requestPersistNvs();
    markStatusDirty();
    return;
  }
  if (key == ATTR_TOOL_LIMIT) {
    toolLimit = (int)value;
    reconcileToolLifeFromShared();
    requestPersistNvs();
    markStatusDirty();
    return;
  }
  if (key == ATTR_TOOL_USED) {
    toolUsed = (int)value;
    reconcileToolLifeFromShared();
    requestPersistNvs();
    markStatusDirty();
  }
}

static void onConnect(bool connected) {
  if (connected) {
    sharedAttrsReceived = false;
    pendingBootAttrSync = true;
    pendingClientMirrorOnConnect = true;
  }
}

static void connectWifiAndSyncTime(const char* ssid, const char* password) {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(WIFI_PS_NONE);
  WiFi.begin(ssid, password);
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
  out.frequencyHz = regs[7] / 10.0f;
  out.powerFactor = regs[8] / 100.0f;
  return out.voltageV >= 0.0f && out.voltageV <= 320.0f &&
         out.currentA >= 0.0f && out.currentA < 120.0f;
}

static float readCurrentAmps(bool* sensorOk, float* voltageV, float* powerW) {
  PzemReading pzem;
  if (readPZEM(pzem)) {
    *sensorOk = true;
    if (voltageV) *voltageV = pzem.voltageV;
    if (powerW) *powerW = pzem.powerW;
    return pzem.currentA;
  }
  *sensorOk = false;
  if (voltageV) *voltageV = 0.0f;
  if (powerW) *powerW = 0.0f;
  return 0.0f;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("[BOOT] esp_wifi — MQTT + PZEM + SSR");

  prefs.begin("ac_mach", false);
  loadRuntimeFromNvs();

  pinMode(PIN_SSR_ALLOW, OUTPUT);
  applySsrOutput();
  Serial.print("[SSR] boot output=");
  Serial.println(sessionActive ? "ON" : "OFF");

  LinkSerial.begin(LINK_BAUD, SERIAL_8N1, LINK_RX, LINK_TX);
  pinMode(LINK_RX, INPUT_PULLUP);
  delay(100);

  Serial.printf("[LINK] UART RX=GPIO%d TX=GPIO%d baud=%d\n", LINK_RX, LINK_TX, LINK_BAUD);
  Serial.println("[LINK] wire: this TX19→peer RX21, this RX21←peer TX19, GND");

  PzemSerial.begin(PZEM_BAUD, SERIAL_8N1, PZEM_UART_RX, PZEM_UART_TX);

  SDKConfig config;
  config.wifiSSID = "71";
  config.wifiPassword = "90946062";
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
#else
  config.mqttPort = 8883;
  config.wssPort = 8084;
  config.enableWS = true;
  config.mqttUseTls = true;
  config.allowInsecureTLS = false;
  config.rootCA = AUTOCONNECTO_ROOT_CA;
#endif

  connectWifiAndSyncTime(config.wifiSSID.c_str(), config.wifiPassword.c_str());
  delay(500);

  sdk.onAttributeUpdate(onSharedAttribute);
  sdk.onConnect(onConnect);
  sdk.begin(config);

  initLinkUart();
  Serial.println("[LINK] UART reinit after WiFi/MQTT");

  linkSendHello();
  markStatusDirty();
  pushStatusToBle();
}

unsigned long lastTelemetryMs = 0;
unsigned long lastSharedSyncMs = 0;
unsigned long lastClientPushMs = 0;

void loop() {
  sdk.loop();
  mqttUp = sdk.connected();

  pollLinkRx();
  flushPersistNvs();

  if (statusDirty && millis() - lastStatusDirtyMs >= 100) {
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
  if (pendingSlotClientAttr && isMqttUp()) {
    pendingSlotClientAttr = false;
    sdk.sendClientAttribute(ATTR_MACHINE_SLOT, (float)machineSlot);
    markStatusDirty();
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

  if (nowMs - lastTelemetryMs >= TELEMETRY_MS) {
    lastTelemetryMs = nowMs;
    bool sensorOk = true;
    float voltageV = 0.0f;
    float powerW = 0.0f;
    const float amps = readCurrentAmps(&sensorOk, &voltageV, &powerW);

    StaticJsonDocument<384> tel;
    tel[KEY_CURRENT] = amps;
    tel[KEY_VOLTAGE] = voltageV;
    tel[KEY_POWER] = powerW;
    tel[KEY_SENSOR_OK] = sensorOk;
    tel[KEY_SESSION_ACTIVE] = sessionActive;
    tel[KEY_CYCLE_COUNT] = cycleCount;
    tel[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
    tel[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
    if (sessionActive) {
      tel[KEY_OPERATOR_ID] = operatorId;
      tel[KEY_OPERATOR_NAME] = operatorName;
    }
    sdk.sendTelemetry(tel);

    Serial.print("[PZEM] V=");
    Serial.print(voltageV, 1);
    Serial.print("V I=");
    Serial.print(amps, 3);
    Serial.print("A P=");
    Serial.print(powerW, 0);
    Serial.print("W mqtt=");
    Serial.println(isMqttUp() ? "up" : "down");
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
