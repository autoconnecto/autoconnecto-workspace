// =============================================================
// Machine_Runtime_NFC_enroll — write worker id + name to MIFARE card
//
// Location: tools/machine-runtime-nfc/Machine_Runtime_NFC_enroll/
// Flash on desk ESP32 + PN532 (same wiring as production).
// Serial Monitor 115200:
//   w worker1 Rajesh Kumar   — write card (hold card on reader)
//   r                        — read back
//
// Card layout: sdk/MACHINE_RUNTIME_NFC.md
// Minimum wiring: SDA 21, SCL 22, 5V, GND (IRQ/RST optional for desk)
// =============================================================

#include <Wire.h>
#include <Adafruit_PN532.h>

#define PN532_IRQ 4    // optional: IRQ; also try H_REQ pulse if module has REQ pin
#define PN532_H_REQ 4  // wire module IRQ or H_REQ -> GPIO 4 if I2C still no 0x24
#define PN532_RESET 5
// Physical wires stay on GPIO 21 + 22; sketch tries normal then swapped SDA/SCL
#define I2C_PIN_A 21
#define I2C_PIN_B 22

#define MIFARE_SECTOR 1
#define MIFARE_BLOCK_MAGIC 4
#define MIFARE_BLOCK_EMP_ID 5
#define MIFARE_BLOCK_NAME 6
static const char CARD_MAGIC[] = "ACMRUNv1";

static uint8_t g_keyA[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// I2C constructor — irq/rst optional if not wired; module switch must be I2C
Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET, &Wire);

static bool i2cHasDevice(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

/** NXP: wake PN532 by addressing slave 0x24 (8-bit 0x48) even when asleep */
static void wakePn532I2c() {
  for (int i = 0; i < 8; i++) {
    Wire.beginTransmission(0x24);
    Wire.endTransmission();
    delay(20);
  }
}

static void pulseHReq() {
  pinMode(PN532_H_REQ, OUTPUT);
  digitalWrite(PN532_H_REQ, LOW);
  delay(2);
  digitalWrite(PN532_H_REQ, HIGH);
  delay(10);
}

static uint32_t tryPn532I2c(int sdaPin, int sclPin) {
  Wire.end();
  delay(30);
  Wire.begin(sdaPin, sclPin);
  Wire.setClock(10000);  // very slow — PN532 clock-stretches heavily on ESP32
#if defined(WIRE_HAS_TIMEOUT)
  Wire.setTimeOut(3000);
#endif
  delay(50);

  pinMode(PN532_RESET, OUTPUT);
  digitalWrite(PN532_RESET, LOW);
  delay(50);
  digitalWrite(PN532_RESET, HIGH);
  delay(200);

  pulseHReq();
  wakePn532I2c();

  Serial.print("  I2C SDA=");
  Serial.print(sdaPin);
  Serial.print(" SCL=");
  Serial.println(sclPin);
  scanI2cBus();

  uint32_t fw = 0;
  for (int attempt = 0; attempt < 8 && !fw; attempt++) {
    if (attempt > 0) {
      pulseHReq();
      wakePn532I2c();
      delay(150);
    }
    if (!nfc.begin()) {
      Serial.println("  begin() failed");
    }
    fw = nfc.getFirmwareVersion();
  }
  return fw;
}

static void scanI2cBus() {
  Serial.println("I2C scan (PN532 must be 0x24 — not 0x28)...");
  uint8_t found = 0;
  bool has24 = false;
  bool has28 = false;
  for (uint8_t addr = 1; addr < 127; addr++) {
    if (!i2cHasDevice(addr)) continue;
    Serial.print("  found 0x");
    if (addr < 16) Serial.print('0');
    Serial.println(addr, HEX);
    found++;
    if (addr == 0x24) has24 = true;
    if (addr == 0x28) has28 = true;
  }
  if (!found) {
    Serial.println("  no I2C devices — check SDA/SCL, 5V, GND, module I2C switch");
    return;
  }
  if (has28 && !has24) {
    Serial.println("  NOTE: 0x28 only = EEPROM/aux on board, NOT the PN532 chip.");
    Serial.println("  PN532 is still in wrong mode (UART/SPI) or asleep — fix DIP switch.");
  }
  if (has24) {
    Serial.println("  OK: 0x24 present — PN532 should respond.");
  }
}

static void padBlock(const char* ascii, uint8_t* block, size_t maxLen) {
  memset(block, 0, 16);
  size_t n = strlen(ascii);
  if (n > maxLen) n = maxLen;
  if (n > 16) n = 16;
  memcpy(block, ascii, n);
}

static bool waitForCard(uint8_t* uid, uint8_t* uidLen) {
  Serial.println("Place MIFARE card on PN532...");
  for (int i = 0; i < 50; i++) {
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, uidLen, 100)) {
      return true;
    }
    delay(200);
  }
  return false;
}

static bool writeWorkerCard(const String& empId, const String& displayName) {
  uint8_t uid[7] = {0};
  uint8_t uidLen = 0;

  if (!waitForCard(uid, &uidLen)) {
    Serial.println("No card detected");
    return false;
  }

  if (!nfc.mifareclassic_AuthenticateBlock(uid, MIFARE_BLOCK_MAGIC, MIFARE_SECTOR, MIFARE_CMD_AUTH_A, g_keyA)) {
    Serial.println("Auth failed — use MIFARE Classic 1K cards");
    return false;
  }

  uint8_t block[16];
  padBlock(CARD_MAGIC, block, 8);
  if (!nfc.mifareclassic_WriteDataBlock(MIFARE_BLOCK_MAGIC, block)) {
    Serial.println("Write magic failed");
    return false;
  }

  padBlock(empId.c_str(), block, 16);
  if (!nfc.mifareclassic_WriteDataBlock(MIFARE_BLOCK_EMP_ID, block)) {
    Serial.println("Write employee_id failed");
    return false;
  }

  padBlock(displayName.c_str(), block, 16);
  if (!nfc.mifareclassic_WriteDataBlock(MIFARE_BLOCK_NAME, block)) {
    Serial.println("Write display_name failed");
    return false;
  }

  Serial.println("OK — card written:");
  Serial.print("  id:   ");
  Serial.println(empId);
  Serial.print("  name: ");
  Serial.println(displayName);
  return true;
}

static bool readWorkerCard() {
  uint8_t uid[7] = {0};
  uint8_t uidLen = 0;

  if (!waitForCard(uid, &uidLen)) return false;

  if (!nfc.mifareclassic_AuthenticateBlock(uid, MIFARE_BLOCK_MAGIC, MIFARE_SECTOR, MIFARE_CMD_AUTH_A, g_keyA)) {
    Serial.println("Auth failed");
    return false;
  }

  uint8_t block[16];
  nfc.mifareclassic_ReadDataBlock(MIFARE_BLOCK_MAGIC, block);
  block[8] = 0;
  Serial.print("magic: ");
  Serial.println((char*)block);

  nfc.mifareclassic_ReadDataBlock(MIFARE_BLOCK_EMP_ID, block);
  block[15] = 0;
  Serial.print("id:    ");
  Serial.println((char*)block);

  nfc.mifareclassic_ReadDataBlock(MIFARE_BLOCK_NAME, block);
  block[15] = 0;
  Serial.print("name:  ");
  Serial.println((char*)block);
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("=== NFC enroll (I2C) ===");
  Serial.println("Switch=10. PN532 SDA/SCL -> GPIO 21+22 (any order).");
  Serial.println("PZEM uses 16/17 — OK; keep PN532 on I2C only.");
  Serial.println("Trying both SDA/SCL pin orders in software...");

  uint32_t fw = tryPn532I2c(I2C_PIN_A, I2C_PIN_B);
  if (!fw) {
    Serial.println("  first order failed — trying swapped SDA/SCL...");
    fw = tryPn532I2c(I2C_PIN_B, I2C_PIN_A);
  }

  if (!fw) {
    Serial.println("PN532 not found — your log shows 21/22 is correct (0x28), not 22/21.");
    Serial.println("EEPROM works; PN532 chip still not on I2C. Try in order:");
    Serial.println("  A) Wire module IRQ or H_REQ pin -> ESP GPIO 4, re-flash");
    Serial.println("  B) DIP switch test — unplug USB, set switch, plug in, note scan:");
    Serial.println("       10 -> I2C (yours: 0x28 only)");
    Serial.println("       01 -> SPI (use enroll_spi sketch + SPI wires)");
    Serial.println("       00 -> UART (needs PN532 on 16/17 — conflicts with PZEM)");
    Serial.println("       11 -> try and note scan");
    Serial.println("  C) If only 0x28 on all I2C positions -> module may be faulty");
    while (1) delay(1000);
  }
  Serial.print("PN532 firmware 0x");
  Serial.println(fw, HEX);
  nfc.SAMConfig();

  Serial.println("=== Machine Runtime NFC enrollment ===");
  Serial.println("  w <employee_id> <display name>");
  Serial.println("  r  — read card");
  Serial.println("Example: w worker1 Rajesh Kumar");
}

void loop() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();
  if (!line.length()) return;

  if (line.startsWith("w ")) {
    line = line.substring(2);
    line.trim();
    int sp = line.indexOf(' ');
    if (sp < 1) {
      Serial.println("Usage: w worker1 Rajesh Kumar");
      return;
    }
    writeWorkerCard(line.substring(0, sp), line.substring(sp + 1));
    return;
  }

  if (line == "r") {
    readWorkerCard();
    return;
  }

  Serial.println("Unknown command");
}
