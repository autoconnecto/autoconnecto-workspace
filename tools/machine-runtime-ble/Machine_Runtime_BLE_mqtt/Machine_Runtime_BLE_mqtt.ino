// =============================================================
// Machine_Runtime_BLE_mqtt — Rev 3 worker app + BLE (Android)
//
// Location: tools/machine-runtime-ble/Machine_Runtime_BLE_mqtt/
// Contract: sdk/MACHINE_RUNTIME_BLE.md
//
// Owner sets on platform (SHARED):
//   machine_slot  (number, e.g. 7) — ESP syncs via MQTT, BLE name AC-007
//
// Power cycle: session + jobs + SSR state persisted in NVS (ac_mach); boot restores
// before MQTT. See MACHINE_RUNTIME_BLE.md § Power cycle survival.
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
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <AutoconnectoSDK.h>

AutoconnectoSDK sdk;

// --- Telemetry / attribute keys (same as MACHINE_RUNTIME.md) ---
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
/** PZEM-004T v3/v4: 32-bit current/power = (reg_high << 16) | reg_low (mA / 0.1 W). */
#define PZEM_RAW_DEBUG 1
#define PIN_SSR_ALLOW 2

/** PZEM-004T snapshot — must be above any function (Arduino IDE auto-prototypes). */
struct PzemReading {
  float voltageV;
  float currentA;
  float powerW;
  float frequencyHz;
  float powerFactor;
};

struct PzemRawSnapshot {
  uint16_t regs[10];
  uint8_t regCount;
};

#define SHARED_SYNC_MS 60000UL
#define CLIENT_PUSH_MS 30000UL
#define TELEMETRY_MS 10000UL
#define BLE_HEARTBEAT_TIMEOUT_MS 900000UL
#define BLE_STALE_GATT_MS 45000UL
#define BLE_ADV_RECONCILE_MS 5000UL
#define BLE_START_MAX_WAIT_MS 20000UL
#define BLE_MIN_AFTER_MQTT_MS 4000UL

// Single-core: sdk.loop() runs in Arduino loop() only (no pinned MQTT task).
#define USE_MQTT_PUMP_TASK 0

// 1 = laptop/backend on LAN (EMQX :1883, Nest :3000). 0 = production.
#define LOCAL_DEV 1

// ---------------------------------------------------------------------------
// DEVICE CREDENTIAL — MQTT + HTTP use **device token** only (never device ID).
// Dashboard → Fleet Setup → Edit machine → "Copy token"
// Do NOT use "Device ID" at the bottom of the edit drawer (different UUID).
// ---------------------------------------------------------------------------
static const char* DEVICE_TOKEN = "1047388e-d0d7-44a3-98c7-9258ba977add";

// HTTP backup for SHARED attrs — disabled for stability (MQTT shared snapshot is enough).
#define HTTP_ATTR_FALLBACK 0

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

#define NVS_RUNTIME_VERSION 2

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
static bool pendingClientMirrorOnConnect = false;
static bool pendingBootAttrSync = false;
static bool pendingStatusNotify = false;
static bool pendingSsrApply = false;
static bool pendingPersistNvs = false;
static bool pendingBleCmdReady = false;
static char pendingBleCmd[256];
static char statusJsonBuf[384];

/** BLE/NimBLE callbacks run on a different task — never touch MQTT or heavy BLE there. */
static bool onAppLoopThread() {
  return xPortGetCoreID() == ARDUINO_RUNNING_CORE;
}

/** Persist full runtime snapshot — survives power cycle (NVS). */
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

/** Restore RAM + SSR from NVS before MQTT (power-cycle survival). */
static void loadRuntimeFromNvs() {
  const int nvVer = prefs.getInt("nv_ver", 0);
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

  if (sessionActive) {
  // Grace period — phone may not have reconnected BLE yet after power cycle.
    lastBleHeartbeatMs = millis();
  }

  Serial.print("[NV] restore v=");
  Serial.print(nvVer);
  Serial.print(" slot=");
  Serial.print(machineSlot);
  Serial.print(" session=");
  Serial.print(sessionActive ? "1" : "0");
  Serial.print(" jobs=");
  Serial.print(cycleCount);
  Serial.print(" allow_run=");
  Serial.print(allowRun ? "1" : "0");
  if (sessionActive && operatorId.length()) {
    Serial.print(" op=");
    Serial.print(operatorId);
  }
  Serial.println();
}

static SemaphoreHandle_t sdkMutex = nullptr;
static volatile bool mqttUp = false;
static unsigned long lastCoexUpdateMs = 0;

static bool sdkLock(TickType_t timeout = pdMS_TO_TICKS(300)) {
  if (!sdkMutex) return true;
  return xSemaphoreTake(sdkMutex, timeout) == pdTRUE;
}

static void sdkUnlock() {
  if (sdkMutex) xSemaphoreGive(sdkMutex);
}

static bool isMqttUp() {
  return mqttUp;
}

#if USE_MQTT_PUMP_TASK
static TaskHandle_t mqttTaskHandle = nullptr;

static void mqttPumpTask(void* /*param*/) {
  for (;;) {
    if (sdkLock(pdMS_TO_TICKS(50))) {
      sdk.loop();
      mqttUp = sdk.connected();
      sdkUnlock();
    }
    vTaskDelay(1);
  }
}

static void startMqttPumpTask() {
  if (mqttTaskHandle) return;
  sdkMutex = xSemaphoreCreateMutex();
  if (!sdkMutex) {
    Serial.println("[CPU] warn — sdk mutex create failed; MQTT stays on app loop");
    return;
  }
  const BaseType_t ok = xTaskCreatePinnedToCore(
    mqttPumpTask,
    "mqtt_pump",
    8192,
    nullptr,
    2,
    &mqttTaskHandle,
    0
  );
  if (ok != pdPASS) {
    Serial.println("[CPU] warn — mqtt_pump task create failed");
    mqttTaskHandle = nullptr;
    return;
  }
  Serial.println("[CPU] mqtt pump pinned core 0");
}
#else
static void initSdkMutex() {
  if (!sdkMutex) {
    sdkMutex = xSemaphoreCreateMutex();
  }
}
#endif

/** WiFi and BLE share one 2.4 GHz radio — cores only separate CPU work. */
static void updateCoexPreference() {
  const bool blePeer =
    bleClientConnected || (bleServer && bleServer->getConnectedCount() > 0);
  if (blePeer) {
    esp_coex_preference_set(ESP_COEX_PREFER_BT);
  } else if (sessionActive) {
    esp_coex_preference_set(ESP_COEX_PREFER_BALANCE);
  } else {
    esp_coex_preference_set(ESP_COEX_PREFER_WIFI);
  }
}

static void applySsrOutput() {
  // SSR follows operator session only — app "stop" / End shift is the sole OFF path.
  digitalWrite(PIN_SSR_ALLOW, sessionActive ? HIGH : LOW);
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

static size_t fillStatusJsonBuf() {
  StaticJsonDocument<384> doc;
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
  doc["ble_linked"] = bleClientConnected;
  if (sessionStartTs > 0) doc["session_start_ts"] = sessionStartTs;
  if (sessionEndTs > 0) doc["session_end_ts"] = sessionEndTs;
  if (operatorId.length()) doc["operator_id"] = operatorId;
  if (operatorName.length()) doc["operator_name"] = operatorName;
  return serializeJson(doc, statusJsonBuf, sizeof(statusJsonBuf));
}

/** Always mirror RAM session state into the GATT value (READ on reconnect). */
static void syncStatusCharacteristic(bool notify) {
  if (!statusChar || !onAppLoopThread()) {
    pendingStatusNotify = true;
    return;
  }
  const size_t n = fillStatusJsonBuf();
  if (!n) return;
  statusChar->setValue((uint8_t*)statusJsonBuf, n);
  if (notify && bleClientConnected) {
    statusChar->notify();
  }
}

static void pushStatusNotify() {
  if (!onAppLoopThread()) {
    pendingStatusNotify = true;
    return;
  }
  syncStatusCharacteristic(true);
}

static void requestPersistNvs() {
  pendingPersistNvs = true;
}

static void flushPersistNvs() {
  if (!pendingPersistNvs) return;
  pendingPersistNvs = false;
  persistRuntimeToNvs();
}

static void pushClientMirror(bool pushOperatorTelemetry = false) {
  if (!onAppLoopThread()) {
    pendingClientMirrorOnConnect = true;
    return;
  }
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
  if (sdkLock()) {
    sdk.sendClientAttributes(attrs);
    if (pushOperatorTelemetry) {
      StaticJsonDocument<320> tel;
      tel[KEY_OPERATOR_ID] = operatorId;
      tel[KEY_OPERATOR_NAME] = operatorName;
      tel[KEY_SESSION_ACTIVE] = sessionActive;
      tel[KEY_CYCLE_COUNT] = cycleCount;
      tel[KEY_SESSION_START_TS] = sessionStartTs > 0 ? sessionStartTs : 0;
      tel[KEY_SESSION_END_TS] = sessionEndTs > 0 ? sessionEndTs : 0;
      bool telOk = sdk.sendTelemetry(tel);
      Serial.print("[MQTT] telemetry cycle_count=");
      Serial.print(cycleCount);
      Serial.print(" session=");
      Serial.print(sessionActive ? "1" : "0");
      Serial.print(" ok=");
      Serial.println(telOk ? "1" : "0");
    }
    sdkUnlock();
  } else if (pushOperatorTelemetry) {
    Serial.println("[MQTT] telemetry skipped — sdk lock timeout");
  }
}

static void resetSessionJobs() {
  cycleCount = 0;
  prefs.putInt("cycle_count", 0);
}

static void endSession(const char* reason) {
  if (strcmp(reason, "stop") != 0) {
    Serial.print("[BLE] session end ignored (not app stop): ");
    Serial.println(reason);
    return;
  }
  sessionActive = false;
  operatorId = "";
  operatorName = "";
  resetSessionJobs();
  const long endedAt = nowEpochSec();
  if (endedAt > 0) {
    sessionEndTs = endedAt;
  }
  applySsrOutput();
  requestPersistNvs();
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
    if (statusChar && onAppLoopThread()) {
      StaticJsonDocument<320> doc;
      doc["slot"] = machineSlot;
      doc["session"] = true;
      doc["session_busy"] = true;
      doc["jobs"] = cycleCount;
      doc["allow_run"] = allowRun;
      doc["ble_linked"] = bleClientConnected;
      doc["operator_id"] = operatorId;
      doc["operator_name"] = operatorName;
      char busyBuf[320];
      const size_t n = serializeJson(doc, busyBuf, sizeof(busyBuf));
      if (n) {
        statusChar->setValue((uint8_t*)busyBuf, n);
        statusChar->notify();
      }
    } else {
      pendingStatusNotify = true;
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
  requestPersistNvs();
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
      Serial.println("[BLE] tool life exhausted — block new jobs; session stays ON until app stop");
      pushStatusNotify();
      requestPersistNvs();
      return;
    }
  }
  requestPersistNvs();
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
  if (!strcmp(cmd, "sync_attrs")) {
    requestPlatformSync("worker_app");
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
    pendingStatusNotify = true;
    Serial.print("[BLE] client connected handle=");
    Serial.println(bleConnHandle);
  }
  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    bleClientConnected = false;
    bleConnHandle = 0xFFFF;
    touchGattActivity();
    bleAdvertRestartPending = true;
    Serial.print("[BLE] client disconnected reason=");
    Serial.println(reason);
  }
};

class BleCmdCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic, NimBLEConnInfo& connInfo) override {
    touchGattActivity();
    const std::string& v = pCharacteristic->getValue();
    if (!v.length() || v.length() >= sizeof(pendingBleCmd)) return;
    memcpy(pendingBleCmd, v.data(), v.length());
    pendingBleCmd[v.length()] = '\0';
    pendingBleCmdReady = true;
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
    updateCoexPreference();
    return;
  }

  bleClientConnected = true;
  updateCoexPreference();
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
  restartBleAdvertising("loop_deferred");
  updateCoexPreference();
}

static void requestPlatformSync(const char* reason) {
  Serial.print("[SYNC] ");
  Serial.print(reason);
  if (!isMqttUp()) {
    Serial.println(" — skip (MQTT not up)");
    return;
  }
  Serial.println(" — pull shared attrs");
  if (sdkLock()) {
    sdk.requestSharedAttributes(SHARED_ATTR_KEYS);
    sdkUnlock();
  }
}

/** TLS to mqtt.autoconnecto.in fails without valid clock (SNTP). */
static void connectWifiAndSyncTime(const char* ssid, const char* password) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] connecting");
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    yield();
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
    yield();
  }
  Serial.println("[NTP] warn — MQTT TLS may fail until time syncs");
}

static void onSharedAttribute(const String& key, float value) {
  // SDK delivers numeric attrs only; machine_code is string (app list) — skip.
  if (key == "machine_code") return;

  sharedAttrsReceived = true;

  if (key == ATTR_ALLOW_RUN) {
    allowRun = value >= 0.5f;
    requestPersistNvs();
    pendingStatusNotify = true;
    return;
  }
  if (key == ATTR_MACHINE_SLOT) {
    const int slot = (int)value;
    if (slot > 0 && slot != machineSlot) {
      machineSlot = slot;
      pendingSlotClientAttr = true;
      if (bleInited) {
        bleAdvertRestartPending = true;
      }
    }
    requestPersistNvs();
    pendingStatusNotify = true;
    return;
  }
  if (key == ATTR_TOOL_REMAINING) {
    toolRemaining = (int)value;
    requestPersistNvs();
    pendingStatusNotify = true;
    return;
  }
  if (key == ATTR_TOOL_LIMIT) {
    toolLimit = (int)value;
    requestPersistNvs();
    return;
  }
  if (key == ATTR_TOOL_USED) {
    toolUsed = (int)value;
    requestPersistNvs();
  }
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
  http.setTimeout(8000);
  const int code = http.GET();
  const String body = http.getString();
  http.end();
  yield();
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
    httpAttrFetchAtMs = millis() + 1500UL;
#endif
    pendingBootAttrSync = true;
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
    vTaskDelay(1);
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

/** PZEM-004T v3/v4 input regs 0x0000..0x0009 (read all 10 for diagnostics). */
static bool readPZEM(PzemReading& out, PzemRawSnapshot* rawOut = nullptr) {
  uint16_t regs[10] = {0};
  const uint8_t regCount = 10;
  if (!modbusReadInputRegs(PZEM_SLAVE_ADDR, 0x0000, regCount, regs)) {
    return false;
  }
  if (rawOut) {
    rawOut->regCount = regCount;
    for (uint8_t i = 0; i < regCount; i++) rawOut->regs[i] = regs[i];
  }
  out.voltageV = regs[0] / 10.0f;
  const uint32_t currentRaw = ((uint32_t)regs[2] << 16) | regs[1];
  out.currentA = currentRaw / 1000.0f;
  const uint32_t powerRaw = ((uint32_t)regs[4] << 16) | regs[3];
  out.powerW = powerRaw / 10.0f;
  out.frequencyHz = regs[7] / 10.0f;
  out.powerFactor = regs[8] / 100.0f;
  return true;
}

static void logPzemDiagnostics(const PzemReading& pzem, const PzemRawSnapshot& raw) {
  Serial.print("[PZEM] diag V=");
  Serial.print(pzem.voltageV, 1);
  Serial.print("V I=");
  Serial.print(pzem.currentA, 3);
  Serial.print("A P=");
  Serial.print(pzem.powerW, 1);
  Serial.print("W F=");
  Serial.print(pzem.frequencyHz, 1);
  Serial.print("Hz PF=");
  Serial.print(pzem.powerFactor, 2);
  Serial.print(" raw");
  for (uint8_t i = 0; i < raw.regCount; i++) {
    Serial.print(i == 0 ? "[" : ",");
    Serial.print(raw.regs[i]);
  }
  Serial.print("]");
  if (pzem.frequencyHz >= 45.0f && pzem.frequencyHz <= 65.0f) {
    Serial.print(" modbus=ok");
  } else {
    Serial.print(" modbus=check_freq");
  }
  if (pzem.currentA < 0.15f && pzem.voltageV > 80.0f) {
    Serial.print(" hint=CT_jack_or_single_live_wire");
  }
  Serial.println();
}

static bool pzemReadingValid(const PzemReading& r) {
  return r.voltageV >= 0.0f && r.voltageV <= 320.0f &&
         r.currentA >= 0.0f && r.currentA < 120.0f &&
         r.powerW >= 0.0f && r.powerW < 35000.0f;
}

static float readDemoCurrentAmps() {
  const unsigned long phase = (millis() / 40000UL) % 3UL;
  if (phase == 0) return 0.2f;
  if (phase == 1) return 4.0f;
  return 22.0f;
}

static float readCurrentAmps(bool* sensorOk, float* voltageV = nullptr, float* powerW = nullptr) {
  PzemRawSnapshot raw;
  PzemReading pzem;
  if (readPZEM(pzem, &raw) && pzemReadingValid(pzem)) {
    *sensorOk = true;
    if (voltageV) *voltageV = pzem.voltageV;
    if (powerW) *powerW = pzem.powerW;
#if PZEM_RAW_DEBUG
    static unsigned long lastRawLogMs = 0;
    const unsigned long now = millis();
    if (now - lastRawLogMs >= 10000UL) {
      lastRawLogMs = now;
      logPzemDiagnostics(pzem, raw);
    }
#endif
    return pzem.currentA;
  }

#if PZEM_RAW_DEBUG
  Serial.println("[PZEM] read failed or out of range — check addr 0xF8, 5V, TX/RX");
#endif

#if PZEM_DEMO_FALLBACK
  *sensorOk = false;
  if (voltageV) *voltageV = 230.0f;
  if (powerW) {
    const float demo = readDemoCurrentAmps();
    *powerW = demo * 230.0f;
  }
  return readDemoCurrentAmps();
#else
  *sensorOk = false;
  if (voltageV) *voltageV = 0.0f;
  if (powerW) *powerW = 0.0f;
  return 0.0f;
#endif
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[BOOT] setup start — stability rev 4 (BLE cmds deferred to loop)");

  prefs.begin("ac_mach", false);
  loadRuntimeFromNvs();

  pinMode(PIN_SSR_ALLOW, OUTPUT);
  applySsrOutput();
  Serial.print("[SSR] boot output=");
  Serial.println(sessionActive ? "ON" : "OFF");

  // Free ~40KB for BLE stack (must run before any BLE init)
  if (esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT) != ESP_OK) {
    Serial.println("[BLE] classic BT mem release failed");
  }
  WiFi.setSleep(WIFI_PS_NONE);

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

  Serial.print("[MEM] heap before MQTT ");
  Serial.println(ESP.getFreeHeap());
  sdk.begin(config);
#if USE_MQTT_PUMP_TASK
  startMqttPumpTask();
#else
  initSdkMutex();
  Serial.println("[CPU] single-core — sdk.loop in Arduino loop");
#endif
  updateCoexPreference();

  Serial.print("[CPU] setup running on core ");
  Serial.println(xPortGetCoreID());

  Serial.println("[SDK] Machine_Runtime_BLE — worker app + MQTT");
  Serial.println("[BLE] deferred — starts from loop after MQTT stable");
  scheduleBleStart();
}

unsigned long lastTelemetryMs = 0;
unsigned long lastSharedSyncMs = 0;
unsigned long lastClientPushMs = 0;

void loop() {
  const unsigned long nowMs = millis();

#if USE_MQTT_PUMP_TASK
  if (!mqttTaskHandle) {
    if (sdkLock(pdMS_TO_TICKS(10))) {
      sdk.loop();
      mqttUp = sdk.connected();
      sdkUnlock();
    }
  }
#else
  if (sdkLock(pdMS_TO_TICKS(10))) {
    sdk.loop();
    mqttUp = sdk.connected();
    sdkUnlock();
  }
#endif

  if (nowMs - lastCoexUpdateMs >= 10000UL) {
    lastCoexUpdateMs = nowMs;
    updateCoexPreference();
  }

  flushPersistNvs();

  if (pendingBleCmdReady) {
    pendingBleCmdReady = false;
    handleBleCommand(String(pendingBleCmd));
  }

  if (pendingSsrApply) {
    pendingSsrApply = false;
    applySsrOutput();
  }

  if (pendingStatusNotify) {
    pendingStatusNotify = false;
    syncStatusCharacteristic(bleClientConnected);
  }

  if (pendingClientMirrorOnConnect && isMqttUp()) {
    pendingClientMirrorOnConnect = false;
    pushClientMirror(true);
  }

  if (pendingBootAttrSync && isMqttUp()) {
    pendingBootAttrSync = false;
    requestPlatformSync("mqtt_connect");
  }

#if HTTP_ATTR_FALLBACK
  // HTTP only if MQTT shared snapshot never arrived (e.g. broker down).
  if (
    httpAttrFetchPending && isMqttUp() &&
    !sharedAttrsReceived && millis() >= httpAttrFetchAtMs
  ) {
    httpAttrFetchPending = false;
    fetchSharedAttrsViaHttp();
    pendingSsrApply = true;
    pendingStatusNotify = true;
  }
#endif

  if (pendingSlotClientAttr && isMqttUp()) {
    pendingSlotClientAttr = false;
    if (sdkLock()) {
      sdk.sendClientAttribute(ATTR_MACHINE_SLOT, (float)machineSlot);
      sdkUnlock();
    }
  }

  processBleAdvertRestart();
  ensureBleWatchdog();

  if (bleInited && (nowMs - lastAdvCheckMs) >= BLE_ADV_RECONCILE_MS) {
    lastAdvCheckMs = nowMs;
    reconcileBleAdvertising();
  }

  if (bleStartPending && !bleInited && isMqttUp()) {
    if (nowMs < mqttConnectedAtMs + BLE_MIN_AFTER_MQTT_MS) {
      // wait — attrs/BLE must not run inside MQTT event task
    } else if (sharedAttrsReceived || nowMs >= bleStartAtMs) {
      bleStartPending = false;
      Serial.println("[BLE] starting (deferred from loop)");
      ensureBleStarted();
    }
  }

  // Heartbeat updates lastBleHeartbeatMs only — never ends session (app stop only).

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
    if (sdkLock()) {
      sdk.sendTelemetry(tel);
      sdkUnlock();
    }

    Serial.print("[PZEM] V=");
    Serial.print(voltageV, 1);
    Serial.print("V I=");
    Serial.print(amps, 3);
    Serial.print("A P=");
    Serial.print(powerW, 0);
    Serial.print("W");
    if (amps > 0.0f && amps < 0.15f && voltageV > 50.0f) {
      Serial.print(" (low — load likely not through PZEM; 100W expects ~");
      Serial.print(voltageV > 1.0f ? (100.0f / voltageV) : 0.0f, 2);
      Serial.print("A)");
    }
    Serial.print(" sensor_ok=");
    Serial.print(sensorOk ? "1" : "0");
    Serial.print(" mqtt=");
    Serial.println(isMqttUp() ? "up" : "down");
  }

  vTaskDelay(1);
}
