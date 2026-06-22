// =============================================================
// Machine_Runtime_NFC_diag — raw UART listen + Adafruit probe
//
// Switch 00. ESP TX=21 -> module RX, ESP RX=22 <- module TX, RST=D5
// Serial Monitor 115200. Reports any bytes from PN532 after reset/wake.
// =============================================================

#include <Adafruit_PN532.h>

#define RST 5
#define ESP_TX 21
#define ESP_RX 22

static void dumpRx(HardwareSerial& ser, const char* label, uint16_t ms) {
  Serial.print(label);
  Serial.print(": ");
  uint8_t n = 0;
  const unsigned long end = millis() + ms;
  while ((long)(millis() - end) < 0) {
    while (ser.available()) {
      if (n == 0) Serial.print("bytes ");
      Serial.print("0x");
      uint8_t b = (uint8_t)ser.read();
      if (b < 16) Serial.print('0');
      Serial.print(b, HEX);
      Serial.print(' ');
      n++;
    }
    delay(2);
  }
  Serial.println(n ? "" : "(silence)");
}

static void pulseReset() {
  pinMode(RST, OUTPUT);
  digitalWrite(RST, LOW);
  delay(50);
  digitalWrite(RST, HIGH);
  delay(300);
}

static void hsuWake(HardwareSerial& ser) {
  const uint8_t wake[] = {0x55, 0x55, 0x00, 0x00, 0x00};
  ser.write(wake, sizeof(wake));
  delay(50);
}

static uint32_t adafruitProbe(HardwareSerial& ser, Adafruit_PN532& nfc, const char* tag) {
  Serial.println(tag);
  pulseReset();
  hsuWake(ser);
  dumpRx(ser, "  after wake", 400);
  if (!nfc.begin()) {
    Serial.println("  begin() failed");
    return 0;
  }
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.print("  firmware=0x");
  Serial.println(fw, HEX);
  return fw;
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("=== PN532 UART diag ===");
  Serial.println("If all silence -> wiring, switch, power, or dead chip.");
  Serial.println("Next hardware path: SPI switch 01 + enroll_spi sketch.");

  HardwareSerial u1(1);
  HardwareSerial u2(2);
  Adafruit_PN532 n1(RST, &u1);
  Adafruit_PN532 n2(RST, &u2);

  const uint32_t bauds[] = {115200, 9600};

  for (uint8_t i = 0; i < 2; i++) {
    Serial.println();
    Serial.print("--- baud ");
    Serial.println(bauds[i]);

    u1.end();
    delay(50);
    u1.begin(bauds[i], SERIAL_8N1, ESP_RX, ESP_TX);
    delay(100);
    pulseReset();
    hsuWake(u1);
    dumpRx(u1, "UART1 raw", 600);

    if (adafruitProbe(u1, n1, "UART1 Adafruit")) {
      Serial.println("SUCCESS on UART1");
      return;
    }

    u2.end();
    delay(50);
    u2.begin(bauds[i], SERIAL_8N1, ESP_RX, ESP_TX);
    delay(100);
    pulseReset();
    hsuWake(u2);
    dumpRx(u2, "UART2 raw", 600);

    if (adafruitProbe(u2, n2, "UART2 Adafruit")) {
      Serial.println("SUCCESS on UART2");
      return;
    }
  }

  Serial.println();
  Serial.println("FAILED — try SPI:");
  Serial.println("  switch 01, SCK18 MISO19 MOSI23 SS15 RST5");
  Serial.println("  flash Machine_Runtime_NFC_enroll_spi.ino");
}

void loop() {
  delay(1000);
}
