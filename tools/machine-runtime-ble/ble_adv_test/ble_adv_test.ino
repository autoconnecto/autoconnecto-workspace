// Minimal BLE advert test — flash ONLY on esp_ble board, esp_wifi UNPLUGGED.
// Phone/nRF Connect should see AC-001 within 2 m. No UART, no WiFi.
// Libraries: NimBLE-Arduino

#include <WiFi.h>
#include <esp_bt.h>
#include <NimBLEDevice.h>

#define BLE_SERVICE_UUID "a7c50001-0001-4000-8000-ac0000010001"
#define ADV_NAME "AC-001"

static void startAdvert() {
  NimBLEAdvertisementData primary;
  primary.addServiceUUID(BLE_SERVICE_UUID);

  NimBLEAdvertisementData scanRsp;
  scanRsp.setName(ADV_NAME);

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->setAdvertisementData(primary);
  adv->setScanResponseData(scanRsp);
  adv->setMinInterval(0x20);
  adv->setMaxInterval(0x40);

  const bool ok = adv->start();
  Serial.print("[TEST] advert start=");
  Serial.print(ok ? "ok" : "FAIL");
  Serial.print(" isAdvertising=");
  Serial.println(adv->isAdvertising() ? "yes" : "no");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[TEST] ble_adv_test — unplug esp_wifi, stand phone within 1 m");

  WiFi.mode(WIFI_OFF);
  esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT);

  NimBLEDevice::init(ADV_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  startAdvert();
  Serial.println("[TEST] scan nRF Connect for AC-001");
}

void loop() {
  static unsigned long lastMs = 0;
  const unsigned long now = millis();
  if (now - lastMs >= 3000UL) {
    lastMs = now;
    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
    Serial.print("[TEST] adv=");
    Serial.print(adv && adv->isAdvertising() ? "yes" : "NO");
    Serial.print(" heap=");
    Serial.println(ESP.getFreeHeap());
    if (!adv || !adv->isAdvertising()) {
      Serial.println("[TEST] restarting advert");
      startAdvert();
    }
  }
  delay(20);
}
