# Internal costing — do not send to the customer

Indian market, August 2026. Buy prices are typical distributor / online landed cost, ex-GST. GST 18% extra on almost every line.

## Bill of materials (same for every kVA except CTs)

| Item | Spec | Qty | Buy (INR) |
|---|---|---|---|
| ESP32 | WROOM-32 DevKit | 1 | 350 |
| 3-phase MFM | CT-operated, RS485 Modbus, Class 1 (Selec / Elmeasure / equivalent) | 1 | 4,500 |
| RS485–TTL | MAX485 module | 1 | 60 |
| 4G modem | Wi-Fi CPE / hotspot (ESP32 joins this AP) | 1 | 2,800 |
| PSU | 5 V, 4 A industrial SMPS | 1 | 500 |
| Enclosure kit | IP65 box, DIN rail, 2P MCB, glands, terminals | 1 | 1,800 |
| Wiring | Ferrules, cable, labels | 1 | 400 |
| **Base kit** | | | **10,410** |

### CTs — only line that changes (set of 3, Class 1, 5 A secondary)

| Transformer | Secondary FLC at 415 V | CT ratio | Unit | Set of 3 |
|---|---|---|---|---|
| 25 kVA | 35 A | 50/5 A | 220 | 660 |
| 63 kVA | 88 A | 100/5 A | 300 | 900 |
| 100 kVA | 139 A | 200/5 A | 400 | 1,200 |
| 250 kVA | 348 A | 400/5 A | 650 | 1,950 |
| 500 kVA | 696 A | 800/5 A | 1,100 | 3,300 |

FLC = kVA × 1000 / (√3 × 415). CT is the next standard ratio with ~20–40% headroom.

## Cost to serve (per kit)

| | 25 | 63 | 100 | 250 | 500 |
|---|---|---|---|---|---|
| Base + CTs | 11,070 | 11,310 | 11,610 | 12,360 | 13,710 |
| Logistics / spoilage 8% | 886 | 905 | 929 | 989 | 1,097 |
| Assemble, flash, test, pack | 1,800 | 1,800 | 1,800 | 1,800 | 1,800 |
| 24-month warranty reserve | 600 | 600 | 600 | 600 | 600 |
| **Your cost** | **14,356** | **14,615** | **14,939** | **15,749** | **17,207** |

## Suggested sell prices (ex-GST)

About 36–37% gross margin on the kit. Do not go below 28% unless it is a volume OEM deal.

| Rating | Kit sell | Install (optional) | Year-1 kit + install |
|---|---|---|---|
| 25 kVA | 22,500 | 4,500 | 27,000 |
| 63 kVA | 23,000 | 4,500 | 27,500 |
| 100 kVA | 23,500 | 4,500 | 28,000 |
| 250 kVA | 25,000 | 5,000 | 30,000 |
| 500 kVA | 27,500 | 5,500 | 33,000 |

Travel outside the local city is extra at actuals.

## Autoconnecto platform (public list)

| Plan | /month | /year | Devices | Why for this OEM |
|---|---|---|---|---|
| Starter | 899 | 8,999 | 10 | Pilot (1–10 transformers) |
| Growth | 3,499 | 34,999 | 100 | Commercial fleet, white-label off |
| Enterprise | 19,999 | 199,999 | 500 | Factory + field fleet, white-label on |

SIM / data: budget ₹1,500 per transformer per year if you supply the SIM. Many OEMs use their own Jio/Airtel IoT plan.

## How to quote

1. **Factory-fit (they install):** kit sell only + one tenant plan.
2. **Site retrofit (you commission):** kit + install.
3. **Pilot (recommended first PO):** one of each rating, 10% off kits, Starter or Growth for 90 days, then convert.

Do not give the customer your BOM. The proposal file uses sell prices only.
