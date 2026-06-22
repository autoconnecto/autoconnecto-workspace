// =============================================================
// Machine_Runtime_NFC_enroll_spi — desk card write (SPI)
//
// Switch: 01 (SW1 OFF, SW2 ON) — confirm module label
// Wiring:
//   SCK  -> GPIO 18    MISO -> GPIO 19    MOSI -> GPIO 23
//   SS   -> GPIO 5     (NOT 15 — ESP32 boot strap)
//   RST  -> GPIO 5 (D5) — same as SS? NO: RST=5, use SS on GPIO 4 if RST uses 5
//
// RST and SS both need separate pins:
//   RST -> GPIO 5
//   SS  -> GPIO 4  (or 15 if probe found it)
//
// Power: 3.3V from ESP32 for desk test
// If fail: flash Machine_Runtime_NFC_probe.ino first
// =============================================================

#include <SPI.h>
#include <Adafruit_PN532.h>

#define PN532_SCK  18
#define PN532_MISO 19
#define PN532_MOSI 23
#define PN532_SS   4    // CS/NSS — GPIO 5 used for RST
#define PN532_RESET 5

#define MIFARE_SECTOR 1
#define MIFARE_BLOCK_MAGIC 4
#define MIFARE_BLOCK_EMP_ID 5
#define MIFARE_BLOCK_NAME 6
static const char CARD_MAGIC[] = "ACMRUNv1";

static uint8_t g_keyA[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

Adafruit_PN532 nfc(PN532_SS, &SPI);

static void hwReset() {
  pinMode(PN532_SS, OUTPUT);
  digitalWrite(PN532_SS, HIGH);
  pinMode(PN532_RESET, OUTPUT);
  digitalWrite(PN532_RESET, LOW);
  delay(50);
  digitalWrite(PN532_RESET, HIGH);
  delay(300);
}

static bool initPn532() {
  hwReset();
  SPI.begin(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS);
  delay(50);
  if (!nfc.begin()) {
    Serial.println("begin() failed");
    return false;
  }
  const uint32_t fw = nfc.getFirmwareVersion();
  if (!fw) return false;
  Serial.print("PN532 firmware 0x");
  Serial.println(fw, HEX);
  nfc.SAMConfig();
  return true;
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

  Serial.println("=== NFC enroll (SPI / HW) ===");
  Serial.println("Switch=01. SCK18 MISO19 MOSI23 SS4 RST5. 3.3V.");

  if (!initPn532()) {
    Serial.println("PN532 not found — run Machine_Runtime_NFC_probe.ino");
    Serial.println("Common fixes: SS on GPIO 4 not 15; HW SPI not SW; cold boot");
    while (1) delay(1000);
  }

  Serial.println("  w <employee_id> <display name>");
  Serial.println("  r  — read card");
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
