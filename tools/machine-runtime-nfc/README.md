# Machine runtime NFC — desk + machine sketches

**Status:** Pilot / hardware bring-up (not published in SDK yet)  
**Contract:** [`sdk/MACHINE_RUNTIME_NFC.md`](../../sdk/MACHINE_RUNTIME_NFC.md)  
**BOM:** Rev 2.0 — [Mifra PN532 MT0359](https://mifraelectronics.com/product/pn532-nfc-rfid-read-write-module/) (I2C, GPIO 21/22)

## Sketches

| Folder | Purpose |
|--------|---------|
| [`Machine_Runtime_NFC_enroll/`](Machine_Runtime_NFC_enroll/) | **Desk** — write cards (I2C, switch `10`) |
| [`Machine_Runtime_NFC_enroll_uart/`](Machine_Runtime_NFC_enroll_uart/) | **Desk fallback** — if I2C scan shows only `0x28` (UART, switch `00`) |
| [`Machine_Runtime_NFC_mqtt/`](Machine_Runtime_NFC_mqtt/) | **Machine** — read card, PZEM, MQTT, SSR |

Open the `.ino` inside each folder in Arduino IDE (folder name must match sketch name).

## Arduino libraries

Install via **Library Manager**:

1. **Adafruit PN532**
2. **Adafruit BusIO**
3. **AutoconnectoSDK** (mqtt sketch only — from this repo)

## Wiring — UART/HSU (pilot — switch `00`)

Reuse module **SDA/SCL** pads as UART (I2C did not expose PN532 on ESP32):

| Module pad | PN532 signal | ESP32 |
|------------|--------------|-------|
| **SDA / RX** | module RX (in) | **GPIO 21** (ESP UART1 **TX**) |
| **SCL / TX** | module TX (out) | **GPIO 22** (ESP UART1 **RX**) |
| **RST** | reset | **GPIO 5** (D5) |
| **5V / GND** | power | 5 V, GND |

**Module switch:** **UART / HSU = `00`** (both OFF). Cold boot after switch change (unplug USB 10s).

| Device | UART | ESP32 pins |
|--------|------|------------|
| **PZEM-004T** | UART2 | 16 RX, 17 TX |
| **PN532** | UART1 @ 115200 | 21 TX, 22 RX |

**Desk:** `Machine_Runtime_NFC_enroll_uart.ino` — same `w` / `r` commands.  
**Machine:** `Machine_Runtime_NFC_mqtt.ino` — same UART pins.

If UART and I2C both fail, run `Machine_Runtime_NFC_diag.ino` (raw byte listen), then try **SPI** (`Machine_Runtime_NFC_enroll_spi.ino`, switch `01`).

Cards programmed over UART are normal MIFARE data — machine reads them the same way.

Machine sketch also uses: PZEM UART2 RX=16 TX=17, Fotek SSR GPIO 26.

## First-time setup

1. Wire PN532 in **I2C** mode (4 wires enough for enroll).
2. Flash **`Machine_Runtime_NFC_enroll`** on a desk ESP32.
3. Serial Monitor **115200**: `w worker1 Rajesh Kumar` (card on reader).
4. Verify: `r` → `magic: ACMRUNv1`
5. Flash **`Machine_Runtime_NFC_mqtt`** on machine ESP32; set WiFi + device token.
6. Tap card at machine → dashboard shows worker name/id from card.

## Tap behaviour (machine sketch)

- First tap (or different card): **session IN**
- Second tap **same card**: **session OUT**
- Card without magic `ACMRUNv1`: rejected

## Card layout

| Block | Content |
|-------|---------|
| 4 | `ACMRUNv1` |
| 5 | employee_id (16 chars) |
| 6 | display_name (16 chars per block) |

Default MIFARE key A: `FF FF FF FF FF FF`
