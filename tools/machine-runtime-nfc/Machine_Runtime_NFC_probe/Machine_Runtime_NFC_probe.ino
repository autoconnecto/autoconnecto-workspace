// =============================================================
// Machine_Runtime_NFC_probe — find working PN532 link (new hardware)
//
// Run once per module. Paste full Serial output.
//
// Part A — I2C (switch 10): SDA 21, SCL 22, RST 5, 3.3V or 5V
// Part B — SPI  (switch 01): SCK 18, MISO 19, MOSI 23, SS 5, RST 5
//   (avoid SS on GPIO 15 — ESP32 boot strap pin)
// =============================================================

#include <Wire.h>
#include <SPI.h>
#include <Adafruit_PN532.h>

#define RST 5
#define I2C_SDA 21
#define I2C_SCL 22
#define SPI_SCK 18
#define SPI_MISO 19
#define SPI_MOSI 23

static void pulseReset() {
  pinMode(RST, OUTPUT);
  digitalWrite(RST, HIGH);
  delay(10);
  digitalWrite(RST, LOW);
  delay(50);
  digitalWrite(RST, HIGH);
  delay(300);
}

static void scanI2c() {
  Serial.println("--- I2C scan (switch should be 10) ---");
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);
  bool any = false;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.print("  found 0x");
      if (a < 16) Serial.print('0');
      Serial.println(a, HEX);
      any = true;
    }
  }
  if (!any) Serial.println("  (no devices)");
  Wire.end();
}

static uint32_t tryI2cAdafruit() {
  Serial.println("--- I2C Adafruit (need 0x24 in scan) ---");
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);
  pulseReset();
  Adafruit_PN532 nfc(255, RST, &Wire);
  if (!nfc.begin()) Serial.println("  begin fail");
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.print("  firmware=0x");
  Serial.println(fw, HEX);
  Wire.end();
  return fw;
}

static uint32_t tryHwSpi(uint8_t ssPin) {
  Serial.print("--- HW SPI SS=");
  Serial.println(ssPin);
  pinMode(ssPin, OUTPUT);
  digitalWrite(ssPin, HIGH);
  pulseReset();

  SPI.end();
  delay(20);
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, ssPin);

  Adafruit_PN532 nfc(ssPin, &SPI);
  if (!nfc.begin()) Serial.println("  begin fail");
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.print("  firmware=0x");
  Serial.println(fw, HEX);
  SPI.end();
  return fw;
}

static uint32_t trySwSpi(uint8_t ssPin, bool swapMisoMosi) {
  Serial.print("--- SW SPI SS=");
  Serial.print(ssPin);
  Serial.println(swapMisoMosi ? " MISO/MOSI swapped" : "");
  pinMode(ssPin, OUTPUT);
  digitalWrite(ssPin, HIGH);
  pulseReset();

  const uint8_t miso = swapMisoMosi ? SPI_MOSI : SPI_MISO;
  const uint8_t mosi = swapMisoMosi ? SPI_MISO : SPI_MOSI;
  Adafruit_PN532 nfc(SPI_SCK, miso, mosi, ssPin);
  if (!nfc.begin()) Serial.println("  begin fail");
  const uint32_t fw = nfc.getFirmwareVersion();
  Serial.print("  firmware=0x");
  Serial.println(fw, HEX);
  return fw;
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("=== PN532 hardware probe ===");
  Serial.println("Power: try 3.3V first. RST->GPIO5. Cold boot after switch change.");
  Serial.println();

  scanI2c();
  if (tryI2cAdafruit()) {
    Serial.println(">>> USE I2C enroll sketch, switch 10");
    return;
  }

  Serial.println();
  Serial.println("--- SPI tests (switch should be 01) ---");
  const uint8_t ssPins[] = {5, 15, 33, 4};
  for (uint8_t i = 0; i < 4; i++) {
    if (tryHwSpi(ssPins[i])) {
      Serial.print(">>> USE HW SPI, SS GPIO ");
      Serial.println(ssPins[i]);
      return;
    }
    if (trySwSpi(ssPins[i], false)) {
      Serial.print(">>> USE SW SPI, SS GPIO ");
      Serial.println(ssPins[i]);
      return;
    }
    if (trySwSpi(ssPins[i], true)) {
      Serial.print(">>> USE SW SPI swapped, SS GPIO ");
      Serial.println(ssPins[i]);
      return;
    }
  }

  Serial.println();
  Serial.println("FAILED all probes. Likely causes:");
  Serial.println("  1) Defective PN532 module — try another unit");
  Serial.println("  2) Switch legend on PCB differs — photo of switch + pins");
  Serial.println("  3) Loose solder on module header");
  Serial.println("  4) Wrong chip (not PN532)");
}

void loop() {
  delay(2000);
}
