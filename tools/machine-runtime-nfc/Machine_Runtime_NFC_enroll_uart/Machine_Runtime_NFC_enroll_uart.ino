// =============================================================
// Machine_Runtime_NFC_enroll_uart — desk card write (UART/HSU)
//
// Switch: 00 (both OFF) = UART on most PN532 boards
//
// Switch 00. Module pads: SDA/RX -> ESP TX (21), SCL/TX -> ESP RX (22)
// RST -> GPIO 5. PZEM stays on UART2 16/17 (not used in this sketch).
// PN532 HSU default baud: 115200
// =============================================================

#include <Adafruit_PN532.h>

#define PN532_RESET 5
#define ESP_TX 21   // ESP TX -> module RX (SDA pad on module)
#define ESP_RX 22   // ESP RX <- module TX (SCL pad on module)
#define PN532_UART_BAUD 115200

#define MIFARE_SECTOR 1
#define MIFARE_BLOCK_MAGIC 4
#define MIFARE_BLOCK_EMP_ID 5
#define MIFARE_BLOCK_NAME 6
static const char CARD_MAGIC[] = "ACMRUNv1";

static uint8_t g_keyA[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

HardwareSerial pn532Serial(1);  // UART1 — PZEM uses UART2 on 16/17
Adafruit_PN532 nfc(PN532_RESET, &pn532Serial);

static Adafruit_PN532* activeNfc = &nfc;

static void hwReset() {
  pinMode(PN532_RESET, OUTPUT);
  digitalWrite(PN532_RESET, LOW);
  delay(50);
  digitalWrite(PN532_RESET, HIGH);
  delay(300);
}

static void hsuWake(HardwareSerial& ser) {
  ser.write(0x55);
  delay(10);
}

static uint32_t tryLink(
  HardwareSerial& ser,
  Adafruit_PN532& nfc,
  uint32_t baud,
  int espRx,
  int espTx,
  const char* label
) {
  ser.end();
  delay(80);
  ser.begin(baud, SERIAL_8N1, espRx, espTx);
  delay(100);
  hwReset();
  hsuWake(ser);

  Serial.print("  ");
  Serial.print(label);
  Serial.print(" ... ");

  if (!nfc.begin()) {
    Serial.println("begin fail");
    return 0;
  }
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.println(fw ? "OK" : "no");
  return fw;
}

static void padBlock(const char* ascii, uint8_t* block, size_t maxLen) {
  memset(block, 0, 16);
  size_t n = strlen(ascii);
  if (n > maxLen) n = maxLen;
  if (n > 16) n = 16;
  memcpy(block, ascii, n);
}

static bool waitForCard(uint8_t* uid, uint8_t* uidLen) {
  if (!activeNfc) return false;
  Serial.println("Place MIFARE card on PN532...");
  for (int i = 0; i < 50; i++) {
    if (activeNfc->readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, uidLen, 100)) {
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
  if (!activeNfc->mifareclassic_AuthenticateBlock(uid, MIFARE_BLOCK_MAGIC, MIFARE_SECTOR, MIFARE_CMD_AUTH_A, g_keyA)) {
    Serial.println("Auth failed — use MIFARE Classic 1K cards");
    return false;
  }
  uint8_t block[16];
  padBlock(CARD_MAGIC, block, 8);
  if (!activeNfc->mifareclassic_WriteDataBlock(MIFARE_BLOCK_MAGIC, block)) {
    Serial.println("Write magic failed");
    return false;
  }
  padBlock(empId.c_str(), block, 16);
  if (!activeNfc->mifareclassic_WriteDataBlock(MIFARE_BLOCK_EMP_ID, block)) {
    Serial.println("Write employee_id failed");
    return false;
  }
  padBlock(displayName.c_str(), block, 16);
  if (!activeNfc->mifareclassic_WriteDataBlock(MIFARE_BLOCK_NAME, block)) {
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
  if (!activeNfc->mifareclassic_AuthenticateBlock(uid, MIFARE_BLOCK_MAGIC, MIFARE_SECTOR, MIFARE_CMD_AUTH_A, g_keyA)) {
    Serial.println("Auth failed");
    return false;
  }
  uint8_t block[16];
  activeNfc->mifareclassic_ReadDataBlock(MIFARE_BLOCK_MAGIC, block);
  block[8] = 0;
  Serial.print("magic: ");
  Serial.println((char*)block);
  activeNfc->mifareclassic_ReadDataBlock(MIFARE_BLOCK_EMP_ID, block);
  block[15] = 0;
  Serial.print("id:    ");
  Serial.println((char*)block);
  activeNfc->mifareclassic_ReadDataBlock(MIFARE_BLOCK_NAME, block);
  block[15] = 0;
  Serial.print("name:  ");
  Serial.println((char*)block);
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("=== NFC enroll (UART / HSU) ===");
  Serial.println("Switch=00. ESP TX=21 -> module RX, ESP RX=22 <- module TX");
  Serial.println("UART1, baud 115200 (PN532 default). RST->D5");

  uint32_t fw = tryLink(pn532Serial, nfc, PN532_UART_BAUD, ESP_RX, ESP_TX, "UART1");
  if (!fw) {
    Serial.println("  retry swapped RX/TX ...");
    fw = tryLink(pn532Serial, nfc, PN532_UART_BAUD, ESP_TX, ESP_RX, "UART1 swapped");
  }
  if (!fw) {
    fw = tryLink(pn532Serial, nfc, 9600, ESP_RX, ESP_TX, "UART1 @9600");
  }

  if (!fw) {
    Serial.println("PN532 not found — check:");
    Serial.println("  module SDA/RX pad -> ESP GPIO 21 (TX)");
    Serial.println("  module SCL/TX pad -> ESP GPIO 22 (RX)");
    Serial.println("  switch 00, RST D5, cold boot (unplug USB 10s)");
    while (1) delay(1000);
  }

  Serial.print("PN532 firmware 0x");
  Serial.println(fw, HEX);
  activeNfc->SAMConfig();

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
