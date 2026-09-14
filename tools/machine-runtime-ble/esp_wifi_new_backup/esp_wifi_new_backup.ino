// =============================================================
// esp_wifi_new — PZEM telemetry + local load-cycle counter
//
// Every 2s: read PZEM, publish V/I/P, run load FSM, mirror cycles_count.
//
// Load FSM (hysteresis):
//   on_load  when current > 0.20 A
//   off_load when current < 0.16 A (20% below on-load threshold)
//   One cycle = off_load → on_load → off_load
//
// cycles_count: CLIENT attribute + NVS (survives reboot)
//
// Hardware: PZEM UART2 RX=GPIO16, TX=GPIO17
// Libraries: AutoconnectoSDK, ArduinoJson, Preferences
// =============================================================

#include <WiFi.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <AutoconnectoSDK.h>

AutoconnectoSDK sdk;
Preferences prefs;

#define PZEM_UART_RX 16
#define PZEM_UART_TX 17
#define PZEM_BAUD 9600
#define PZEM_SLAVE_ADDR 0xF8

#define TELEMETRY_MS 2000UL

#define LOCAL_DEV 1

static const char* DEVICE_TOKEN = "1047388e-d0d7-44a3-98c7-9258ba977add";

#if LOCAL_DEV
static const char* MQTT_HOST = "192.168.68.107";
static const char* WIFI_SSID = "71";
static const char* WIFI_PASSWORD = "90946062";
#else
static const char* MQTT_HOST = "mqtt.autoconnecto.in";
static const char* WIFI_SSID = "YOUR_SSID";
static const char* WIFI_PASSWORD = "YOUR_PASSWORD";
#endif

static const char* KEY_CURRENT = "current_current";
static const char* KEY_VOLTAGE = "current_voltage";
static const char* KEY_POWER = "current_power";
static const char* KEY_SENSOR_OK = "machine_sensor_ok";
static const char* ATTR_CYCLES_COUNT = "cycles_count";

/** On-load when current rises above this (A). */
static const float ON_LOAD_A = 0.20f;
/** Off-load when current falls below on_load − 20% (A). */
static const float OFF_LOAD_A = ON_LOAD_A * 0.80f;

enum class LoadPhase : uint8_t { OffLoad, OnLoad };

HardwareSerial PzemSerial(2);

struct PzemReading {
  float voltageV;
  float currentA;
  float powerW;
};

static unsigned long lastTelemetryMs = 0;
static LoadPhase loadPhase = LoadPhase::OffLoad;
static uint32_t cyclesCount = 0;
static bool pendingCyclesMirror = false;

static void persistCyclesCount() {
  prefs.putUInt("cycles_count", cyclesCount);
}

static void loadCyclesCountFromNvs() {
  cyclesCount = prefs.getUInt("cycles_count", 0);
}

static void publishCyclesCountClient() {
  if (!sdk.connected()) return;
  sdk.sendClientAttribute(ATTR_CYCLES_COUNT, (float)cyclesCount);
}

static void onMqttConnect(bool connected) {
  if (connected) {
    pendingCyclesMirror = true;
  }
}

/** Returns true when a full off → on → off cycle completes. */
static bool advanceLoadCycleFsm(float currentA, bool sensorOk) {
  if (!sensorOk) return false;

  if (loadPhase == LoadPhase::OffLoad) {
    if (currentA > ON_LOAD_A) {
      loadPhase = LoadPhase::OnLoad;
    }
    return false;
  }

  if (currentA < OFF_LOAD_A) {
    loadPhase = LoadPhase::OffLoad;
    cyclesCount++;
    persistCyclesCount();
    return true;
  }
  return false;
}

static const char* loadPhaseLabel() {
  return loadPhase == LoadPhase::OnLoad ? "on_load" : "off_load";
}

static void connectWifi() {
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
  Serial.println("[BOOT] esp_wifi_new — PZEM + cycles_count");

  prefs.begin("ac_wifi_new", false);
  loadCyclesCountFromNvs();
  Serial.print("[NV] cycles_count=");
  Serial.println(cyclesCount);

  PzemSerial.begin(PZEM_BAUD, SERIAL_8N1, PZEM_UART_RX, PZEM_UART_TX);

  connectWifi();
  delay(500);

  SDKConfig config;
  config.wifiSSID = WIFI_SSID;
  config.wifiPassword = WIFI_PASSWORD;
  config.mqttHost = MQTT_HOST;
  config.deviceToken = DEVICE_TOKEN;
  config.enableMQTT = true;
  config.enableSerialLogs = true;

#if LOCAL_DEV
  config.mqttPort = 1883;
  config.enableWS = false;
  config.mqttUseTls = false;
  config.allowInsecureTLS = true;
  config.rootCA = nullptr;
#else
  config.mqttPort = 8883;
  config.enableWS = true;
  config.mqttUseTls = true;
  config.allowInsecureTLS = false;
  config.rootCA = AUTOCONNECTO_ROOT_CA;
#endif

  sdk.onConnect(onMqttConnect);
  sdk.begin(config);
  Serial.println("[MQTT] sdk.begin()");
}

void loop() {
  sdk.loop();

  if (pendingCyclesMirror && sdk.connected()) {
    pendingCyclesMirror = false;
    publishCyclesCountClient();
  }

  const unsigned long nowMs = millis();
  if (nowMs - lastTelemetryMs < TELEMETRY_MS) return;
  lastTelemetryMs = nowMs;

  PzemReading pzem;
  const bool sensorOk = readPZEM(pzem);
  const float currentA = sensorOk ? pzem.currentA : 0.0f;
  const bool cycleCompleted = advanceLoadCycleFsm(currentA, sensorOk);

  StaticJsonDocument<224> tel;
  tel[KEY_CURRENT] = currentA;
  tel[KEY_VOLTAGE] = sensorOk ? pzem.voltageV : 0.0f;
  tel[KEY_POWER] = sensorOk ? pzem.powerW : 0.0f;
  tel[KEY_SENSOR_OK] = sensorOk;
  sdk.sendTelemetry(tel);

  publishCyclesCountClient();

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
  if (cycleCompleted) Serial.print(" +1");
  Serial.print(" mqtt=");
  Serial.println(sdk.connected() ? "up" : "down");
}
