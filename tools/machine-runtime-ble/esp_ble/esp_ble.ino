// =============================================================
// esp_ble — Worker app BLE only (bridge to esp_wifi over UART)
//
// UART: Serial1, TX=GPIO19, RX=GPIO21 (same as link_test.ino)
// Wire: cross 19↔21 between boards + GND
//
// Libraries: ArduinoJson, NimBLE-Arduino
// =============================================================

#include <WiFi.h>
#include <esp_bt.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

#define LINK_RX 21
#define LINK_TX 19
#define LINK_BAUD 115200

#define BLE_SERVICE_UUID "a7c50001-0001-4000-8000-ac0000010001"
#define BLE_CMD_CHAR_UUID "a7c50002-0001-4000-8000-ac0000010002"
#define BLE_STATUS_CHAR_UUID "a7c50003-0001-4000-8000-ac0000010003"

#define BLE_ADV_RECONCILE_MS 5000UL
#define STATUS_POLL_MS 3000UL
#define DEFAULT_MACHINE_SLOT 1

HardwareSerial LinkSerial(1);

static NimBLEServer* bleServer = nullptr;
static NimBLECharacteristic* statusChar = nullptr;
static bool bleClientConnected = false;
static bool bleInited = false;
static bool pendingStatusNotify = false;
static bool pendingBleCmdReady = false;
static bool pendingSlotReinit = false;
static char pendingBleCmd[256];
static char statusJsonBuf[384];

static int machineSlot = 0;
static unsigned long lastAdvCheckMs = 0;
static unsigned long lastBleStatusLogMs = 0;
static unsigned long lastStatusPollMs = 0;
static bool linkPeerAlive = false;
static uint32_t linkRxByteCount = 0;

static bool onAppLoopThread() {
  return xPortGetCoreID() == ARDUINO_RUNNING_CORE;
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

/** Same UART init as link_test.ino */
static void beginLinkUart() {
  LinkSerial.end();
  delay(20);
  LinkSerial.begin(LINK_BAUD, SERIAL_8N1, LINK_RX, LINK_TX);
  while (LinkSerial.available()) LinkSerial.read();
}

static void linkSendRaw(const char* line) {
  LinkSerial.print(line);
  LinkSerial.print('\n');
  LinkSerial.flush();
}

static void linkSendLine(const char* line) {
  Serial.print("[LINK] → ");
  Serial.println(line);
  linkSendRaw(line);
}

static void linkRequestStatus() {
  linkSendLine("{\"cmd\":\"get_status\"}");
}

static void applyStatusFromDoc(JsonDocument& doc) {
  const int newSlot = doc["slot"] | machineSlot;
  if (newSlot > 0 && newSlot != machineSlot) {
    machineSlot = newSlot;
    if (bleInited) pendingSlotReinit = true;
  } else if (newSlot > 0) {
    machineSlot = newSlot;
  }
  doc["ble_linked"] = bleClientConnected;
  const size_t n = serializeJson(doc, statusJsonBuf, sizeof(statusJsonBuf));
  if (!n || !statusChar || !onAppLoopThread()) {
    pendingStatusNotify = true;
    return;
  }
  statusChar->setValue((uint8_t*)statusJsonBuf, n);
  if (bleClientConnected) statusChar->notify();
}

/** Identical RX path to link_test.ino */
static void pollLinkRx() {
  while (LinkSerial.available()) {
    String line = LinkSerial.readStringUntil('\n');
    line.trim();
    if (!line.length()) continue;
    linkRxByteCount += line.length();
    linkPeerAlive = true;

    Serial.print("[LINK] ← ");
    Serial.println(line);

    if (line == "PING" || line == "PONG") {
      if (line == "PING") linkSendRaw("PONG");
      continue;
    }
    if (!line.startsWith("{")) continue;

    StaticJsonDocument<384> doc;
    if (deserializeJson(doc, line)) {
      Serial.println("[LINK] bad JSON");
      continue;
    }
    const char* type = doc["type"] | "";
    if (!strcmp(type, "hello") && !strcmp(doc["board"] | "", "wifi")) {
      linkSendLine("{\"type\":\"hello\",\"board\":\"ble\"}");
      linkRequestStatus();
      continue;
    }
    if (strcmp(type, "status") == 0 || doc.containsKey("slot") || doc.containsKey("session")) {
      applyStatusFromDoc(doc);
    }
  }
}

static void syncStatusNotify() {
  if (!statusChar || !onAppLoopThread()) {
    pendingStatusNotify = true;
    return;
  }
  StaticJsonDocument<384> doc;
  if (deserializeJson(doc, statusJsonBuf)) return;
  doc["ble_linked"] = bleClientConnected;
  const size_t n = serializeJson(doc, statusJsonBuf, sizeof(statusJsonBuf));
  if (!n) return;
  statusChar->setValue((uint8_t*)statusJsonBuf, n);
  if (bleClientConnected) statusChar->notify();
}

class BleServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo&) override {
    bleClientConnected = true;
    pendingStatusNotify = true;
    linkRequestStatus();
    Serial.println("[BLE] client connected");
  }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int reason) override {
    bleClientConnected = false;
    pendingStatusNotify = true;
    Serial.print("[BLE] disconnected reason=");
    Serial.println(reason);
  }
};

class BleCmdCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic, NimBLEConnInfo&) override {
    const std::string& v = pCharacteristic->getValue();
    if (!v.length() || v.length() >= sizeof(pendingBleCmd)) return;
    memcpy(pendingBleCmd, v.data(), v.length());
    pendingBleCmd[v.length()] = '\0';
    pendingBleCmdReady = true;
  }
};

static BleServerCallbacks bleServerCallbacks;
static BleCmdCallbacks bleCmdCallbacks;

static void seedDefaultStatusChar() {
  if (!statusChar) return;
  StaticJsonDocument<256> doc;
  const int slot = machineSlot > 0 ? machineSlot : DEFAULT_MACHINE_SLOT;
  doc["slot"] = slot;
  doc["session"] = false;
  doc["jobs"] = 0;
  doc["allow_run"] = true;
  doc["ble_linked"] = false;
  const size_t n = serializeJson(doc, statusJsonBuf, sizeof(statusJsonBuf));
  if (n) statusChar->setValue((uint8_t*)statusJsonBuf, n);
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

/** GATT peer count is truth — Android often skips onDisconnect; keep advert alive when idle. */
static void reconcileBleAdvertising() {
  if (!bleInited || !bleServer) return;

  const uint8_t peerCount = bleServer->getConnectedCount();
  if (peerCount == 0) {
    if (bleClientConnected) {
      Serial.println("[BLE] ghost link cleared — no GATT peers");
    }
    bleClientConnected = false;
    restartBleAdvertising("no_peers");
    return;
  }

  bleClientConnected = true;
}

static bool startBleAdvertising(NimBLEAdvertising* adv, const String& name) {
  if (!adv) return false;

  // Keep primary packet small: 128-bit UUID only (Android service-filter scan).
  // Name goes in scan response (Android unfiltered / nRF Connect name).
  NimBLEAdvertisementData primaryAdv;
  primaryAdv.addServiceUUID(BLE_SERVICE_UUID);

  NimBLEAdvertisementData scanAdv;
  scanAdv.setName(name.c_str());

  adv->setAdvertisementData(primaryAdv);
  adv->setScanResponseData(scanAdv);
  adv->setMinInterval(0x20);
  adv->setMaxInterval(0x40);

  const bool ok = adv->start();
  if (!ok) {
    Serial.println("[BLE] adv->start() FAILED — retry legacy API");
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->setName(name.c_str());
    adv->enableScanResponse(true);
    return adv->start();
  }
  return true;
}

static void initBle() {
  const String name = bleAdvertName();
  NimBLEDevice::init(name.c_str());
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(&bleServerCallbacks);

  NimBLEService* service = bleServer->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic* cmdChar = service->createCharacteristic(
    BLE_CMD_CHAR_UUID, NIMBLE_PROPERTY::WRITE);
  cmdChar->setCallbacks(&bleCmdCallbacks);
  statusChar = service->createCharacteristic(
    BLE_STATUS_CHAR_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  seedDefaultStatusChar();

  service->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  const bool advOk = startBleAdvertising(adv, name);

  bleInited = true;
  Serial.print("[BLE] advertising as ");
  Serial.print(name);
  Serial.print(" adv=");
  Serial.println(advOk && adv->isAdvertising() ? "yes" : "NO");
}

static void logBleStatus(const char* reason) {
  NimBLEAdvertising* adv = bleInited ? NimBLEDevice::getAdvertising() : nullptr;
  Serial.print("[BLE] status (");
  Serial.print(reason);
  Serial.print(") inited=");
  Serial.print(bleInited ? "yes" : "no");
  Serial.print(" peers=");
  Serial.print(bleServer ? bleServer->getConnectedCount() : 0);
  Serial.print(" adv=");
  Serial.print(adv && adv->isAdvertising() ? "yes" : "no");
  Serial.print(" name=");
  Serial.println(bleAdvertName());
}

static void processSlotReinit() {
  if (!pendingSlotReinit || !bleInited) return;
  pendingSlotReinit = false;
  Serial.println("[BLE] reinit for new machine slot");
  NimBLEDevice::deinit(true);
  bleInited = false;
  bleServer = nullptr;
  statusChar = nullptr;
  bleClientConnected = false;
  delay(200);
  initBle();
  beginLinkUart();
}

/** 5 s PING test before BLE — same code path as link_test.ino */
static void preBleLinkTest() {
  Serial.println("[LINK] pre-BLE test 5s (flash link_test on esp_wifi to verify wire)");
  unsigned long lastPing = 0;
  int recvCount = 0;
  const unsigned long deadline = millis() + 5000UL;
  while (millis() < deadline) {
    if (millis() - lastPing >= 2000UL) {
      lastPing = millis();
      linkSendRaw("PING");
      Serial.println("[LINK] pre-BLE sent PING");
    }
    while (LinkSerial.available()) {
      String line = LinkSerial.readStringUntil('\n');
      line.trim();
      if (!line.length()) continue;
      recvCount++;
      Serial.print("[LINK] pre-BLE recv: ");
      Serial.println(line);
      if (line == "PING") linkSendRaw("PONG");
    }
    delay(5);
  }
  Serial.print("[LINK] pre-BLE recv lines=");
  Serial.println(recvCount);
  if (recvCount == 0) {
    Serial.println("[LINK] FAIL pre-BLE — no UART from peer. Fix wire/power before BLE.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("[BOOT] esp_ble — Serial1 TX19 RX21 (same as link_test)");

  WiFi.mode(WIFI_OFF);
  esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT);

#if DEFAULT_MACHINE_SLOT > 0
  machineSlot = DEFAULT_MACHINE_SLOT;
#endif

  beginLinkUart();
  preBleLinkTest();

  initBle();
  beginLinkUart();
  Serial.println("[LINK] UART reinit after BLE");

  linkSendLine("{\"type\":\"hello\",\"board\":\"ble\"}");
  linkRequestStatus();
}

void loop() {
  pollLinkRx();

  if (pendingBleCmdReady) {
    pendingBleCmdReady = false;
    linkSendLine(pendingBleCmd);
  }
  if (pendingStatusNotify) {
    pendingStatusNotify = false;
    syncStatusNotify();
  }
  processSlotReinit();

  const unsigned long now = millis();
  if (now - lastAdvCheckMs >= BLE_ADV_RECONCILE_MS) {
    lastAdvCheckMs = now;
    reconcileBleAdvertising();
  }
  if (now - lastBleStatusLogMs >= 30000UL) {
    lastBleStatusLogMs = now;
    logBleStatus("periodic");
  }
  if (now - lastStatusPollMs >= STATUS_POLL_MS) {
    lastStatusPollMs = now;
    linkRequestStatus();
  }

  delay(5);
}
