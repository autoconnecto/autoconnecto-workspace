// =============================================================
// Machine_Runtime_BLE_mqtt — Rev 3 worker app + BLE (Android)
//
// Location: tools/machine-runtime-ble/Machine_Runtime_BLE_mqtt/
// Contract: sdk/MACHINE_RUNTIME_BLE.md
//
// Owner sets on platform (SHARED):
//   machine_slot  (number, e.g. 7) — ESP syncs via MQTT, BLE name AC-007
//   machine_code  (string, e.g. PRESS07) — app list only (SDK string TBD)
//
// PZEM UART2: RX=16 TX=17 | SSR GPIO 2
//
// Arduino IDE (required — BLE+WiFi+MQTT is large):
//   Partition Scheme → "Huge APP (3MB No OTA/1MB SPIFFS)"
//   Core Debug Level → None
//
// Libraries: AutoconnectoSDK, ArduinoJson, NimBLE-Arduino (Library Manager)
// =============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <esp_bt.h>
#include <esp_coexist.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <AutoconnectoSDK.h>

AutoconnectoSDK sdk;

// --- Telemetry / attribute keys (same as MACHINE_RUNTIME.md) ---
const char* KEY_CURRENT = "machine_current_a";
const char* KEY_SENSOR_OK = "machine_sensor_ok";
const char* KEY_OPERATOR_ID = "machine_operator_id";
const char* KEY_OPERATOR_NAME = "machine_operator_name";
const char* KEY_SESSION_ACTIVE = "machine_session_active";
const char* KEY_SESSION_START_TS = "machine_session_start_ts";
const char* KEY_SESSION_END_TS = "machine_session_end_ts";
const char* KEY_CYCLE_COUNT = "machine_cycle_count";
const char* ATTR_ALLOW_RUN = "machine_allow_run";
const char* ATTR_MACHINE_SLOT = "machine_slot";
const char* ATTR_TOOL_REMAINING = "machine_tool_remaining";
const char* ATTR_TOOL_LIMIT = "machine_tool_limit";
const char* ATTR_TOOL_USED = "machine_tool_cycles_used";

#define PZEM_UART_RX 16
#define PZEM_UART_TX 17
#define PZEM_BAUD 9600
#define PZEM_SLAVE_ADDR 0xF8
#define PZEM_DEMO_FALLBACK 0
#define PIN_SSR_ALLOW 2

#define SHARED_SYNC_MS 60000UL
#define CLIENT_PUSH_MS 30000UL
#define TELEMETRY_MS 10000UL
#define BLE_HEARTBEAT_TIMEOUT_MS 900000UL
#define BLE_STALE_GATT_MS 45000UL
#define BLE_ADV_RECONCILE_MS 5000UL
#define BLE_START_MAX_WAIT_MS 20000UL
#define BLE_MIN_AFTER_MQTT_MS 4000UL
#define HTTP_ATTR_FETCH_DELAY_MS 5000UL

// 1 = laptop/backend on LAN (EMQX :1883, Nest :3000). 0 = production.
#define LOCAL_DEV 1

// ---------------------------------------------------------------------------
// DEVICE CREDENTIAL — MQTT + HTTP use **device token** only (never device ID).
// Dashboard → Fleet Setup → Edit machine → "Copy token"
// Do NOT use "Device ID" at the bottom of the edit drawer (different UUID).
// ---------------------------------------------------------------------------
static const char* DEVICE_TOKEN = "1047388e-d0d7-44a3-98c7-9258ba977add";

// HTTP backup for SHARED attrs when MQTT snapshot/response is slow or missing.
#define HTTP_ATTR_FALLBACK 1

#if LOCAL_DEV
static const char* API_HOST = "192.168.68.107";
static const uint16_t API_PORT = 3000;
static const char* MQTT_HOST = "192.168.68.107";
#else
static const char* API_HOST = "api.autoconnecto.in";
static const uint16_t API_PORT = 443;
static const char* MQTT_HOST = "mqtt.autoconnecto.in";
#endif

static String gDeviceToken;
static bool httpAttrFetchPending = false;
static unsigned long httpAttrFetchAtMs = 0;

// Pull sync keys (SDK README / PAYLOADS.md) — same pattern as AllFunctionTest_mqtt
#define SHARED_ATTR_KEYS \
  "machine_slot,machine_allow_run,machine_tool_remaining,machine_tool_limit,machine_tool_cycles_used"

// Autoconnecto worker BLE GATT (see MACHINE_RUNTIME_BLE.md)
#define BLE_SERVICE_UUID "a7c50001-0001-4000-8000-ac0000010001"
#define BLE_CMD_CHAR_UUID "a7c50002-0001-4000-8000-ac0000010002"
#define BLE_STATUS_CHAR_UUID "a7c50003-0001-4000-8000-ac0000010003"

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

static NimBLEServer* bleServer = nullptr;
static NimBLECharacteristic* statusChar = nullptr;
static unsigned long lastBleHeartbeatMs = 0;
static bool bleClientConnected = false;
static uint16_t bleConnHandle = 0xFFFF;
static unsigned long lastGattActivityMs = 0;
static bool bleInited = false;
static bool bleStartPending = false;
static unsigned long bleStartAtMs = 0;
static unsigned long mqttConnectedAtMs = 0;
static bool sharedAttrsReceived = false;
static bool bleAdvertRestartPending = false;
static unsigned long lastBleWatchdogMs = 0;
static unsigned long lastBleStatusLogMs = 0;
static unsigned long lastAdvCheckMs = 0;
static bool pendingSlotClientAttr = false;
static bool pendingSessionEnd = false;
static const char* pendingSessionEndReason = "";
static bool pendingClientMirrorOnConnect = false;

static void applySsrOutput() {
  digitalWrite(PIN_SSR_ALLOW, (allowRun && sessionActive) ? HIGH : LOW);
}

static String bleAdvertName() {
  char buf[12];
  if (machineSlot > 0) {
    snprintf(buf, sizeof(buf), "AC-%03d", machineSlot);
  } else {
    snprintf(buf, sizeof(buf), "AC-UNSET");
  }
  return String(buf);
}

static long nowEpochSec() {
  const time_t t = time(nullptr);
  return (t > 1700000000L) ? (long)t : 0;
}

static String buildStatusJson() {
  StaticJsonDocument<384> doc;
  doc["slot"] = machineSlot;
  doc["session"] = sessionActive;
  doc["jobs"] = cycleCount;
  doc["allow_run"] = allowRun;
  doc["ble_linked"] = bleClientConnected;
  if (sessionStartTs > 0) doc["session_start_ts"] = sessionStartTs;
  if (sessionEndTs > 0) doc["session_end_ts"] = sessionEndTs;
  if (operatorId.length()) doc["operator_id"] = operatorId;
  if (operatorName.length()) doc["operator_name"] = operatorName;
  String out;
  serializeJson(doc, out);
  return out;
}

/** Always mirror RAM session state into the GATT value (READ on reconnect). */
static void syncStatusCharacteristic(bool notify) {
  if (!statusChar) return;
  const String out = buildStatusJson();
  statusChar->setValue(out.c_str());
  if (notify && bleClientConnected) {
    statusChar->notify();
  }
}

static void pushStatusNotify() {
  syncStatusCharacteristic(true);
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
    sdk.sendTelemetry(tel);
  }
}

static void resetSessionJobs() {
  cycleCount = 0;
  prefs.putInt("cycle_count", 0);
}

static void endSession(const char* reason) {
  sessionActive = false;
  operatorId = "";
  operatorName = "";
  resetSessionJobs();
  const long endedAt = nowEpochSec();
  if (endedAt > 0) {
    sessionEndTs = endedAt;
  }
  applySsrOutput();
  pushClientMirror(true);
  pushStatusNotify();
  Serial.print("[BLE] session end: ");
  Serial.print(reason);
  if (sessionStartTs > 0 && sessionEndTs > 0) {
    Serial.print(" start_ts=");
    Serial.print(sessionStartTs);
    Serial.print(" end_ts=");
    Serial.print(sessionEndTs);
  }
  Serial.println();
}

static void startSession(const String& id, const String& name) {
  if (!allowRun) {
    Serial.println("[BLE] session blocked — tool life");
    pushStatusNotify();
    return;
  }
  if (sessionActive && operatorId.length() && operatorId != id) {
    Serial.print("[BLE] session reject — in use by ");
    Serial.println(operatorId);
    StaticJsonDocument<320> doc;
    doc["slot"] = machineSlot;
    doc["session"] = true;
    doc["session_busy"] = true;
    doc["jobs"] = cycleCount;
    doc["allow_run"] = allowRun;
    doc["ble_linked"] = bleClientConnected;
    doc["operator_id"] = operatorId;
    doc["operator_name"] = operatorName;
    String out;
    serializeJson(doc, out);
    if (statusChar) {
      statusChar->setValue(out.c_str());
      statusChar->notify();
    }
    return;
  }
  if (sessionActive && operatorId == id) {
    lastBleHeartbeatMs = millis();
    pushStatusNotify();
    Serial.println("[BLE] session resume (same operator)");
    return;
  }
  resetSessionJobs();
  operatorId = id;
  operatorName = name.length() ? name : id;
  sessionActive = true;
  sessionEndTs = 0;
  const long startedAt = nowEpochSec();
  if (startedAt > 0) {
    sessionStartTs = startedAt;
  } else {
    Serial.println("[BLE] warn — NTP not synced; session_start_ts unavailable");
  }
  lastBleHeartbeatMs = millis();
  applySsrOutput();
  pushClientMirror(true);
  pushStatusNotify();
  Serial.print("[BLE] session start ");
  Serial.print(operatorId);
  if (sessionStartTs > 0) {
    Serial.print(" start_ts=");
    Serial.print(sessionStartTs);
  }
  Serial.println();
}

static void adjustJobCount(int delta) {
  if (!sessionActive) return;
  if (delta < 0 && cycleCount <= 0) return;
  cycleCount += delta;
  if (cycleCount < 0) cycleCount = 0;
  prefs.putInt("cycle_count", cycleCount);
  if (toolUsed >= 0 && delta > 0) toolUsed += delta;
  if (toolRemaining >= 0 && delta > 0) {
    toolRemaining -= delta;
    if (toolRemaining <= 0) {
      toolRemaining = 0;
      allowRun = false;
      endSession("tool_life");
      return;
    }
  }
  pushClientMirror(true);
  pushStatusNotify();
  Serial.print("[BLE] jobs=");
  Serial.println(cycleCount);
}

static void handleBleCommand(const String& raw) {
  if (!raw.length()) return;
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, raw)) {
    Serial.println("[BLE] bad JSON");
    return;
  }
  const char* cmd = doc["cmd"] | "";
  if (!strcmp(cmd, "heartbeat")) {
    lastBleHeartbeatMs = millis();
    pushStatusNotify();
    return;
  }
  if (!strcmp(cmd, "start")) {
    const char* id = doc["operator_id"] | "";
    const char* name = doc["operator_name"] | "";
    if (!id[0]) return;
    startSession(String(id), String(name));
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

class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    bleClientConnected = true;
    bleConnHandle = connInfo.getConnHandle();
    lastBleHeartbeatMs = millis();
    touchGattActivity();
    syncStatusCharacteristic(true);
    Serial.print("[BLE] client connected handle=");
    Serial.println(bleConnHandle);
  }
  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    bleClientConnected = false;
    bleConnHandle = 0xFFFF;
    touchGattActivity();
    Serial.print("[BLE] client disconnected reason=");
    Serial.println(reason);
    restartBleAdvertising("on_disconnect");
  }
};

class BleCmdCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic, NimBLEConnInfo& connInfo) override {
    touchGattActivity();
    const std::string& v = pCharacteristic->getValue();
    handleBleCommand(String(v.c_str()));
  }
};

static BleServerCallbacks bleServerCallbacks;
static BleCmdCallbacks bleCmdCallbacks;

static void initBle() {
  const String name = bleAdvertName();
  NimBLEDevice::init(name.c_str());
  // N9 is too weak for factory-floor discovery; P3 is a practical default.
  NimBLEDevice::setPower(ESP_PWR_LVL_P3);

  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(&bleServerCallbacks);

  NimBLEService* service = bleServer->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic* cmdChar = service->createCharacteristic(
    BLE_CMD_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE
  );
  cmdChar->setCallbacks(&bleCmdCallbacks);

  statusChar = service->createCharacteristic(
    BLE_STATUS_CHAR_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );

  service->start();
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setName(name.c_str());       // NimBLE 2.x: name not advertised by default
  adv->enableScanResponse(true);    // was setScanResponse() in NimBLE 1.x
  adv->start();

  bleInited = true;
  touchGattActivity();
  Serial.print("[BLE] advertising as ");
  Serial.println(name);
}

static void ensureBleStarted() {
  if (bleInited) return;
  Serial.print("[MEM] heap before BLE ");
  Serial.println(ESP.getFreeHeap());
  // After MQTT connects, free heap is often ~35–42 KB; 45 KB gate blocked BLE forever.
  if (ESP.getFreeHeap() < 32000) {
    Serial.println("[BLE] low heap — retry in 5s");
    bleStartPending = true;
    bleStartAtMs = millis() + 5000;
    return;
  }
  initBle();
  Serial.print("[MEM] heap after BLE ");
  Serial.println(ESP.getFreeHeap());
}

static void restartBleAdvertising(const char* reason) {
  if (!bleInited) return;
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  if (!adv) return;
  if (!adv->isAdvertising()) {
    Serial.print("[BLE] advertising restart (");
    Serial.print(reason);
    Serial.println(")");
  }
  adv->start();
}

static void dropAllBlePeers(const char* reason) {
  if (!bleServer) return;
  const uint8_t peerCount = bleServer->getConnectedCount();
  if (!peerCount) return;
  Serial.print("[BLE] drop ");
  Serial.print(peerCount);
  Serial.print(" peer(s): ");
  Serial.println(reason);
  for (uint8_t i = 0; i < peerCount; i++) {
    const NimBLEConnInfo peer = bleServer->getPeerInfo(i);
    if (peer.getConnHandle() != 0xFFFF && peer.getConnHandle() != 0) {
      bleServer->disconnect(peer);
    }
  }
  bleConnHandle = 0xFFFF;
  bleClientConnected = false;
}

/** Use GATT peer count as source of truth — onDisconnect can be skipped on Android. */
static void reconcileBleAdvertising() {
  if (!bleInited || !bleServer) return;

  const unsigned long now = millis();
  const uint8_t peerCount = bleServer->getConnectedCount();

  if (peerCount == 0) {
    if (bleClientConnected) {
      Serial.println("[BLE] ghost link cleared — no GATT peers");
    }
    bleClientConnected = false;
    bleConnHandle = 0xFFFF;
    restartBleAdvertising("no_peers");
    return;
  }

  bleClientConnected = true;
  if (now - lastGattActivityMs > BLE_STALE_GATT_MS) {
    dropAllBlePeers("stale_gatt");
    restartBleAdvertising("after_stale_drop");
  }
}

static void touchGattActivity() {
  lastGattActivityMs = millis();
}

static void logBleStatus(const char* reason) {
  Serial.print("[BLE] status (");
  Serial.print(reason);
  Serial.print(") inited=");
  Serial.print(bleInited ? "yes" : "no");
  Serial.print(" peers=");
  Serial.print(bleServer ? bleServer->getConnectedCount() : 0);
  Serial.print(" adv=");
  Serial.print(
    bleInited && NimBLEDevice::getAdvertising() &&
      NimBLEDevice::getAdvertising()->isAdvertising()
      ? "yes"
      : "no"
  );
  Serial.print(" name=");
  Serial.print(bleAdvertName());
  Serial.print(" heap=");
  Serial.println(ESP.getFreeHeap());
}

static void ensureBleWatchdog() {
  const unsigned long now = millis();
  if (bleInited) return;
  if (now - lastBleWatchdogMs < 15000UL) return;
  lastBleWatchdogMs = now;
  logBleStatus("watchdog");
  ensureBleStarted();
}

static void processBleAdvertRestart() {
  if (!bleAdvertRestartPending || !bleInited) return;
  bleAdvertRestartPending = false;
  static int lastSlot = -1;
  if (machineSlot == lastSlot) return;
  lastSlot = machineSlot;
  Serial.println("[BLE] restart advert for new machine_slot");
  NimBLEDevice::deinit(true);
  bleInited = false;
  bleServer = nullptr;
  statusChar = nullptr;
  bleStartPending = true;
  bleStartAtMs = millis() + 500;
}

static void requestPlatformSync(const char* reason) {
  Serial.print("[SYNC] ");
  Serial.print(reason);
  if (!sdk.connected()) {
    Serial.println(" — skip (MQTT not up)");
    return;
  }
  Serial.println(" — pull shared attrs");
  sdk.requestSharedAttributes(SHARED_ATTR_KEYS);
}

/** TLS to mqtt.autoconnecto.in fails without valid clock (SNTP). */
static void connectWifiAndSyncTime(const char* ssid, const char* password) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] connecting");
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] failed — check SSID/password");
    return;
  }
  Serial.print("[WiFi] IP ");
  Serial.println(WiFi.localIP());

  WiFi.setDNS(IPAddress(8, 8, 8, 8), IPAddress(8, 8, 4, 4));

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  for (int i = 0; i < 40; i++) {
    if (time(nullptr) > 1700000000L) {
      Serial.println("[NTP] time synced — TLS OK");
      return;
    }
    delay(500);
  }
  Serial.println("[NTP] warn — MQTT TLS may fail until time syncs");
}

static void onSharedAttribute(const String& key, float value) {
  // SDK delivers numeric attrs only; machine_code is string (app list) — skip.
  if (key == "machine_code") return;

  sharedAttrsReceived = true;

  Serial.print("[ATTR] ");
  Serial.print(key);
  Serial.print(" = ");
  Serial.println(value, 3);

  if (key == ATTR_ALLOW_RUN) {
    allowRun = value >= 0.5f;
    if (!allowRun && sessionActive) {
      pendingSessionEnd = true;
      pendingSessionEndReason = "allow_run_false";
    }
    applySsrOutput();
    pushStatusNotify();
    return;
  }
  if (key == ATTR_MACHINE_SLOT) {
    const int slot = (int)value;
    if (slot > 0 && slot != machineSlot) {
      machineSlot = slot;
      prefs.putInt("machine_slot", machineSlot);
      pendingSlotClientAttr = true;
      Serial.print("[ATTR] machine_slot applied → BLE name ");
      Serial.println(bleAdvertName());
      if (bleInited) {
        bleAdvertRestartPending = true;
      }
    }
    pushStatusNotify();
    return;
  }
  if (key == ATTR_TOOL_REMAINING) {
    toolRemaining = (int)value;
    // machine_allow_run (SHARED) is authoritative — stale remaining=0 must not
    // override platform when tool counter is disabled.
    applySsrOutput();
    pushStatusNotify();
    return;
  }
  if (key == ATTR_TOOL_LIMIT) toolLimit = (int)value;
  if (key == ATTR_TOOL_USED) toolUsed = (int)value;
}

/** HTTPS fallback when MQTT shared snapshot/response is missing (device-token API). */
static bool fetchSharedAttrsViaHttp() {
  Serial.println("[HTTP] GET shared attrs (fallback)");
  HTTPClient http;
  const String path =
    String("/api/v1/") + gDeviceToken +
    "/attributes/flat?scope=SHARED&keys=" + SHARED_ATTR_KEYS;
#if LOCAL_DEV
  WiFiClient plain;
  const String url =
    String("http://") + API_HOST + ":" + String(API_PORT) + path;
  if (!http.begin(plain, url)) {
#else
  WiFiClientSecure tls;
  tls.setCACert(AUTOCONNECTO_ROOT_CA);
  const String url = String("https://") + API_HOST + path;
  if (!http.begin(tls, url)) {
#endif
    Serial.println("[HTTP] begin failed");
    return false;
  }
  Serial.println(url);
  http.setTimeout(20000);
  const int code = http.GET();
  const String body = http.getString();
  http.end();
  Serial.print("[HTTP] status ");
  Serial.println(code);
  if (code != 200) {
    Serial.println(body);
    return false;
  }
  Serial.print("[HTTP] ");
  Serial.println(body);
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, body) || !doc.is<JsonArray>()) {
    Serial.println("[HTTP] bad JSON array");
    return false;
  }
  int n = 0;
  for (JsonObject item : doc.as<JsonArray>()) {
    const char* key = item["key"] | "";
    if (!key[0]) continue;
    const JsonVariant val = item["value"];
    float f = 0.0f;
    if (val.is<int>() || val.is<float>()) {
      f = val.as<float>();
    } else if (val.is<bool>()) {
      f = val.as<bool>() ? 1.0f : 0.0f;
    } else if (val.is<const char*>()) {
      f = String(val.as<const char*>()).toFloat();
    }
    onSharedAttribute(String(key), f);
    n++;
  }
  if (n > 0) sharedAttrsReceived = true;
  Serial.print("[HTTP] applied ");
  Serial.print(n);
  Serial.println(" keys");
  return n > 0;
}

static void scheduleBleStart() {
  if (bleInited || bleStartPending) return;
  bleStartPending = true;
  bleStartAtMs = millis() + BLE_START_MAX_WAIT_MS;
}

static void onConnect(bool connected) {
  if (connected) {
    mqttConnectedAtMs = millis();
    sharedAttrsReceived = false;
    if (!bleInited) {
      scheduleBleStart();
    }
#if HTTP_ATTR_FALLBACK
    httpAttrFetchPending = true;
    httpAttrFetchAtMs = millis() + HTTP_ATTR_FETCH_DELAY_MS;
#endif
    pendingClientMirrorOnConnect = true;
  }
}

// --- PZEM (same as Machine_Runtime) ---
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
    sdk.loop();
    if (PzemSerial.available()) resp[idx++] = (uint8_t)PzemSerial.read();
  }
  if (idx < 5 || resp[0] != slave || resp[1] != 0x04) return false;
  const uint8_t byteCount = resp[2];
  if (idx < (size_t)(3 + byteCount + 2)) return false;
  if (modbusCRC(resp, 3 + byteCount) != ((uint16_t)resp[3 + byteCount] | ((uint16_t)resp[4 + byteCount] << 8))) return false;
  for (uint16_t i = 0; i < count; i++) {
    out[i] = ((uint16_t)resp[3 + i * 2] << 8) | resp[4 + i * 2];
  }
  return true;
}

static float readPZEMCurrentAmps() {
  uint16_t regs[2] = {0, 0};
  if (!modbusReadInputRegs(PZEM_SLAVE_ADDR, 0x0001, 2, regs)) return NAN;
  return (((uint32_t)regs[0] << 16) | regs[1]) / 1000.0f;
}

static float readDemoCurrentAmps() {
  const unsigned long phase = (millis() / 40000UL) % 3UL;
  if (phase == 0) return 0.2f;
  if (phase == 1) return 4.0f;
  return 22.0f;
}

static float readCurrentAmps(bool* sensorOk) {
  float amps = readPZEMCurrentAmps();
  if (!isnan(amps) && amps >= 0.0f && amps < 120.0f) {
    *sensorOk = true;
    return amps;
  }
#if PZEM_DEMO_FALLBACK
  *sensorOk = false;
  return readDemoCurrentAmps();
#else
  *sensorOk = false;
  return 0.0f;
#endif
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  prefs.begin("ac_mach", false);
  machineSlot = prefs.getInt("machine_slot", 0);
  cycleCount = prefs.getInt("cycle_count", 0);

  pinMode(PIN_SSR_ALLOW, OUTPUT);
  digitalWrite(PIN_SSR_ALLOW, LOW);

  // Free ~40KB for BLE stack (must run before any BLE init)
  if (esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT) != ESP_OK) {
    Serial.println("[BLE] classic BT mem release failed");
  }
  WiFi.setSleep(WIFI_PS_NONE);
  // BLE + WiFi share the radio — bias slightly toward WiFi so MQTT pings are not starved.
  esp_coex_preference_set(ESP_COEX_PREFER_WIFI);

  PzemSerial.begin(PZEM_BAUD, SERIAL_8N1, PZEM_UART_RX, PZEM_UART_TX);
  delay(100);

  SDKConfig config;
  config.wifiSSID = "71";
  config.wifiPassword = "90946062";
  config.mqttHost = MQTT_HOST;
  config.deviceToken = DEVICE_TOKEN;
  gDeviceToken = config.deviceToken;
  config.enableMQTT = true;
  config.sharedAttributeKeys = SHARED_ATTR_KEYS;
  config.enableSerialLogs = true;

  if (
    strcmp(DEVICE_TOKEN, "PASTE_DEVICE_TOKEN_HERE") == 0 ||
    strlen(DEVICE_TOKEN) < 8
  ) {
    Serial.println("[CFG] FATAL: Set DEVICE_TOKEN at top of .ino");
    Serial.println("[CFG] Use Copy token from dashboard — NOT Device ID");
  } else {
    Serial.print("[CFG] device token len=");
    Serial.println(strlen(DEVICE_TOKEN));
    Serial.println("[CFG] MQTT topic prefix: devices/<token>/...");
  }

#if LOCAL_DEV
  // Plain MQTT to local EMQX (docker 1883) + HTTP API :3000
  config.mqttPort = 1883;
  config.wssPort = 8083;
  config.enableWS = false;
  config.mqttUseTls = false;
  config.allowInsecureTLS = true;
  config.rootCA = nullptr;
  Serial.println("[CFG] LOCAL dev → mqtt://192.168.68.107:1883 api :3000");
#else
  config.mqttPort = 8883;
  config.wssPort = 8084;
  config.enableWS = true;
  config.mqttUseTls = true;
  config.allowInsecureTLS = false;
  config.rootCA = AUTOCONNECTO_ROOT_CA;
  Serial.println("[CFG] PRODUCTION → mqtt.autoconnecto.in");
#endif

  connectWifiAndSyncTime(
    config.wifiSSID.c_str(),
    config.wifiPassword.c_str()
  );

  // WiFi+NTP done — SDK will skip re-connecting WiFi (see NetworkConnect.cpp).
  delay(1000);

  sdk.onAttributeUpdate(onSharedAttribute);
  sdk.onConnect(onConnect);

  // BLE needs contiguous heap — start before MQTT TLS buffers are allocated.
  Serial.print("[MEM] heap before BLE ");
  Serial.println(ESP.getFreeHeap());
  Serial.println("[BLE] starting early (pre-MQTT)");
  ensureBleStarted();
  logBleStatus("boot");

  Serial.print("[MEM] heap before MQTT ");
  Serial.println(ESP.getFreeHeap());
  sdk.begin(config);

  applySsrOutput();

  Serial.println("[SDK] Machine_Runtime_BLE — worker app + MQTT");
  if (!bleInited) {
    Serial.println("[BLE] warn — not advertising at boot; watchdog will retry");
    bleStartPending = true;
    bleStartAtMs = millis() + 5000;
  }
}

unsigned long lastTelemetryMs = 0;
unsigned long lastSharedSyncMs = 0;
unsigned long lastClientPushMs = 0;

void loop() {
  const unsigned long nowMs = millis();
  sdk.loop();

  if (pendingSessionEnd) {
    pendingSessionEnd = false;
    endSession(pendingSessionEndReason);
  }

  if (pendingClientMirrorOnConnect && sdk.connected()) {
    pendingClientMirrorOnConnect = false;
    pushClientMirror(false);
  }

#if HTTP_ATTR_FALLBACK
  if (
    httpAttrFetchPending && sdk.connected() &&
    !sharedAttrsReceived && millis() >= httpAttrFetchAtMs
  ) {
    httpAttrFetchPending = false;
    fetchSharedAttrsViaHttp();
  }
#endif

  if (pendingSlotClientAttr && sdk.connected()) {
    pendingSlotClientAttr = false;
    sdk.sendClientAttribute(ATTR_MACHINE_SLOT, (float)machineSlot);
  }

  processBleAdvertRestart();
  ensureBleWatchdog();

  if (bleInited && (nowMs - lastAdvCheckMs) >= BLE_ADV_RECONCILE_MS) {
    lastAdvCheckMs = nowMs;
    reconcileBleAdvertising();
  }

  if (bleStartPending && !bleInited && sdk.connected()) {
    if (nowMs < mqttConnectedAtMs + BLE_MIN_AFTER_MQTT_MS) {
      // wait — attrs/BLE must not run inside MQTT event task
    } else if (sharedAttrsReceived || nowMs >= bleStartAtMs) {
      bleStartPending = false;
      Serial.println("[BLE] starting (deferred from loop)");
      ensureBleStarted();
    }
  }

  if (sessionActive && bleClientConnected &&
      (nowMs - lastBleHeartbeatMs) > BLE_HEARTBEAT_TIMEOUT_MS) {
    endSession("heartbeat_timeout");
  }

  if (nowMs - lastSharedSyncMs >= SHARED_SYNC_MS) {
    lastSharedSyncMs = nowMs;
    requestPlatformSync("periodic");
    if (nowMs - lastBleStatusLogMs >= SHARED_SYNC_MS) {
      lastBleStatusLogMs = nowMs;
      logBleStatus("periodic");
    }
  }

  if (nowMs - lastClientPushMs >= CLIENT_PUSH_MS) {
    lastClientPushMs = nowMs;
    pushClientMirror(false);
  }

  if (sessionActive && bleInited && !bleClientConnected) {
    static unsigned long lastOfflineStatusSyncMs = 0;
    if (nowMs - lastOfflineStatusSyncMs >= 5000UL) {
      lastOfflineStatusSyncMs = nowMs;
      syncStatusCharacteristic(false);
    }
  }

  if (nowMs - lastTelemetryMs >= TELEMETRY_MS) {
    lastTelemetryMs = nowMs;
    bool sensorOk = true;
    const float amps = readCurrentAmps(&sensorOk);

    StaticJsonDocument<320> tel;
    tel[KEY_CURRENT] = amps;
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

    Serial.print("[PZEM] I=");
    Serial.print(amps, 3);
    Serial.print("A sensor_ok=");
    Serial.print(sensorOk ? "1" : "0");
    Serial.print(" mqtt=");
    Serial.println(sdk.connected() ? "up" : "down");
  }

  delay(1);
}
