// =============================================================
// UART wiring test — flash on BOTH ESP32 boards (identical sketch).
//
// Your wiring (cross):
//   Board-A GPIO 19 (TX)  →  Board-B GPIO 21 (RX)
//   Board-A GPIO 21 (RX)  ←  Board-B GPIO 19 (TX)
//   GND ↔ GND
//
// Both boards use TX=19, RX=21 — same as esp_ble / esp_wifi after fix.
//
// PASS: both serial monitors show sent PING and recv: PONG within ~2 s.
// =============================================================

#define LINK_RX 21
#define LINK_TX 19

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial1.begin(115200, SERIAL_8N1, LINK_RX, LINK_TX);
  Serial.println();
  Serial.println("[TEST] UART link_test — identical on both boards");
  Serial.printf("[TEST] RX=GPIO%d TX=GPIO%d\n", LINK_RX, LINK_TX);
  Serial.println("[TEST] wire: TX19→peer21, RX21←peer19, GND common");
}

void loop() {
  static unsigned long lastPingMs = 0;
  const unsigned long now = millis();

  if (now - lastPingMs >= 2000UL) {
    lastPingMs = now;
    Serial1.println("PING");
    Serial1.flush();
    Serial.println("[TEST] sent PING on TX19");
  }

  while (Serial1.available()) {
    String line = Serial1.readStringUntil('\n');
    line.trim();
    if (!line.length()) continue;
    Serial.print("[TEST] recv on RX21: ");
    Serial.println(line);
    if (line == "PING") {
      Serial1.println("PONG");
      Serial1.flush();
      Serial.println("[TEST] sent PONG on TX19");
    }
  }

  delay(5);
}
