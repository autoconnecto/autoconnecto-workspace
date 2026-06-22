// =============================================================
// PN532 UART test on ESP32 GPIO 16 / 17 only
//
// DISCONNECT PZEM for this test (same pins).
// Switch: 00 (UART / HSU — both OFF)
// Power: 3.3V, GND, RST -> GPIO 5
//
// Wiring A (try first):
//   module SDA/RX pad -> ESP GPIO 17 (TX)
//   module SCL/TX pad -> ESP GPIO 16 (RX)
//
// Wiring B (if A fails — swap module wires on 16/17)
// =============================================================

#include <Adafruit_PN532.h>

#define RST 5
#define ESP_RX 16
#define ESP_TX 17

HardwareSerial pn532Ser(2);
Adafruit_PN532 nfc(RST, &pn532Ser);

static void resetModule() {
  pinMode(RST, OUTPUT);
  digitalWrite(RST, LOW);
  delay(50);
  digitalWrite(RST, HIGH);
  delay(300);
}

static void hsuWake() {
  pn532Ser.write(0x55);
  delay(20);
}

static uint32_t tryUart(uint32_t baud, int rxPin, int txPin, const char* label) {
  pn532Ser.end();
  delay(50);
  pn532Ser.begin(baud, SERIAL_8N1, rxPin, txPin);
  delay(100);
  resetModule();
  hsuWake();

  Serial.print(label);
  Serial.print(" @ ");
  Serial.print(baud);
  Serial.print(" ... ");

  if (!nfc.begin()) {
    Serial.println("begin fail");
    return 0;
  }
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.println(fw ? "OK" : "no");
  if (fw) {
    Serial.print("  firmware 0x");
    Serial.println(fw, HEX);
  }
  return fw;
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("=== PN532 UART test GPIO 16/17 ===");
  Serial.println("PZEM disconnected. Switch 00. RST=5. 3.3V");

  const uint32_t bauds[] = {115200, 9600};
  uint32_t fw = 0;

  for (uint8_t i = 0; i < 2 && !fw; i++) {
    fw = tryUart(bauds[i], ESP_RX, ESP_TX, "A: RX16 TX17");
    if (!fw) fw = tryUart(bauds[i], ESP_TX, ESP_RX, "B: RX17 TX16 swapped");
  }

  if (!fw) {
    Serial.println("FAILED — no PN532 on UART 16/17");
    while (1) delay(1000);
  }

  nfc.SAMConfig();
  Serial.println("SUCCESS — tap card to read UID:");

  uint8_t uid[7];
  uint8_t uidLen = 0;
  for (int t = 0; t < 30; t++) {
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 200)) {
      Serial.print("UID: ");
      for (uint8_t i = 0; i < uidLen; i++) {
        if (uid[i] < 16) Serial.print('0');
        Serial.print(uid[i], HEX);
        Serial.print(' ');
      }
      Serial.println();
      return;
    }
    delay(300);
  }
  Serial.println("Chip OK but no card seen — hold card on coil");
}

void loop() {
  delay(1000);
}
