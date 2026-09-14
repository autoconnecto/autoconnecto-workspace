# Proposal: Real-time monitoring for distribution transformers

**Prepared for:** [Customer — Distribution Transformer OEM]  
**Prepared by:** Autoconnecto  
**Date:** 13 August 2026  
**Validity:** 30 days  
**Reference:** DT-MON-2026-01

---

## 1. Executive summary

You manufacture distribution transformers (25, 63, 100, 250 and 500 kVA). Your customers — DISCOMs, industries, and commercial campuses — increasingly ask for **live electrical health** of the transformer after it is energised: voltage, current, load, power factor, energy, and alarms when something is wrong.

We propose a factory-fit (or site-retrofit) monitoring kit on each transformer, connected to the **Autoconnecto** cloud. Operators see a 3-phase dashboard, change alarm limits themselves, and get notified when voltage, overload, imbalance, power factor, frequency, or communication fails.

Hardware is the same on every rating. **Only the three CTs change.**

| What you buy | What you get |
|---|---|
| One monitoring kit per transformer | ESP32 + 3-phase meter + CTs + 4G + enclosure, wired and tested |
| Autoconnecto subscription | Live dashboard, alarms, history, multi-user access |
| Optional commissioning | We install and prove the first sites with your team |

---

## 2. Understanding of the requirement

A distribution transformer is a long-life asset. Failures are expensive: oil, windings, downtime, and penalty. Most yards still rely on periodic visits or a local meter that nobody logs.

You asked for:

- Real-time 3-phase electrical monitoring on 25 / 63 / 100 / 250 / 500 kVA units
- A dashboard your service and customer teams can open from a browser or phone
- Alarms they can tune (voltage band, overload, PF, frequency, imbalance)
- A kit that your factory can fit before dispatch, or that we can retrofit

This proposal covers electrical monitoring from a CT-operated 3-phase meter. Oil temperature, winding temperature, and Buchholz can be added later on the same platform without replacing the dashboard pattern.

---

## 3. Solution

### 3.1 Architecture

```
CTs (R, Y, B) → 3-phase energy meter (RS485)
                      ↓
              RS485-to-TTL converter
                      ↓
                    ESP32
                      ↓  Wi-Fi
              4G modem / hotspot
                      ↓
              Autoconnecto cloud
                      ↓
         Dashboard · Alarms · History
```

The meter measures voltage, current, kW, kVA, kVAR, PF, Hz and kWh. The ESP32 reads Modbus over RS485 and publishes telemetry every few seconds. Autoconnecto stores the data, evaluates alarm rules, and streams the dashboard.

### 3.2 What the operator sees

- Live R / Y / B voltage and current
- kW, kVA, kVAR, power factor, frequency, kWh
- Load % against the transformer rating
- Current imbalance
- Analog meters and 1-hour trends
- Active alarms with severity
- **Alarm limits** the user can change on the dashboard (no firmware flash)

### 3.3 Alarms (defaults for a 415 V system)

| Alarm | Default trip | Operator can change |
|---|---|---|
| Overvoltage (any phase, L-N) | > 253 V | Yes |
| Undervoltage (any phase, L-N) | < 216 V | Yes |
| Overcurrent (any phase) | > CT / rating limit | Yes |
| Overload | > 90% of rated kVA | Yes |
| Low power factor | < 0.80 | Yes |
| Over / under frequency | > 51.5 Hz / < 48.5 Hz | Yes |
| Current imbalance | > 20% | Yes |
| Communication loss | No data for 3 minutes | Fixed |

Limits are stored as device settings. Changing them on the dashboard changes the next alarm evaluation. No site visit.

### 3.4 Ratings and CTs

Secondary current at 415 V: I = kVA × 1000 / (√3 × 415).

| Rating | Full-load current | CT (set of 3) |
|---|---|---|
| 25 kVA | 35 A | 50/5 A |
| 63 kVA | 88 A | 100/5 A |
| 100 kVA | 139 A | 200/5 A |
| 250 kVA | 348 A | 400/5 A |
| 500 kVA | 696 A | 800/5 A |

Meter, ESP32, converter, 4G modem, 5 V / 4 A supply, and enclosure stay the same.

---

## 4. Commercial offer

Prices are in INR, **ex-GST**. GST at 18% extra. Validity 30 days.

### 4.1 Monitoring kit (one-time, per transformer)

Includes assembled, programmed, and tested hardware: ESP32, 3-phase RS485 meter, RS485–TTL, 4G Wi-Fi modem, 5 V 4 A PSU, IP65 enclosure kit, wiring, and the three CTs for that rating.

| Transformer | Kit (INR) |
|---|---|
| 25 kVA | 22,500 |
| 63 kVA | 23,000 |
| 100 kVA | 23,500 |
| 250 kVA | 25,000 |
| 500 kVA | 27,500 |

### 4.2 Optional site commissioning

| Work | INR per site |
|---|---|
| Install, CT orientation, modem SIM, prove live data | 4,500 (25–100 kVA) / 5,000 (250 kVA) / 5,500 (500 kVA) |

Travel and stay outside the local city: at actuals.

### 4.3 Autoconnecto platform (recurring)

One tenant for your company. Every transformer is one device.

| If you monitor | Plan | Devices included | Price |
|---|---|---|---|
| Pilot, up to 10 transformers | Starter | 10 | ₹899 / month or ₹8,999 / year |
| Up to 100 transformers | Growth | 100 | ₹3,499 / month or ₹34,999 / year |
| Up to 500, your brand on the UI | Enterprise | 500 | ₹19,999 / month or ₹199,999 / year |

History retention: 60 days (Starter), 180 days (Growth), 365 days (Enterprise).

SIM / data is not included. Budget about ₹1,500 per transformer per year, or use your own IoT SIM.

### 4.4 Example year-1 numbers

**A. Factory-fit, 20 transformers (mix), you install**

- Kits (illustrative mix: 4×25, 4×63, 6×100, 4×250, 2×500) = ₹4,78,000
- Growth plan annual = ₹34,999
- **Year-1 total ≈ ₹5.13 lakh** (ex-GST), then only the platform + SIMs

**B. Single 100 kVA retrofit we commission**

- Kit ₹23,500 + install ₹4,500 + Starter (if this is the first device) ₹8,999 / year  
- Or add the device to an existing Growth tenant at no extra kit-side SaaS

### 4.5 Pilot (recommended first purchase)

| Item | Qty | Price |
|---|---|---|
| One kit of each rating (25, 63, 100, 250, 500 kVA) | 5 | ₹1,09,350 after 10% pilot discount (list ₹1,21,500) |
| Commissioning of those 5 sites | 5 | ₹24,000 |
| Autoconnecto Growth, first 90 days | 1 | Included in pilot |
| **Pilot total** | | **₹1,33,350** ex-GST |

After 90 days the Growth plan continues at the public annual rate unless you choose Starter or Enterprise.

### 4.6 From year 2

- Platform: renew the same plan.
- Hardware AMC (optional): 12% of kit value per year — remote support, firmware updates, one preventive check if we are in the city.
- Replacement CTs or modem: at parts list.

---

## 5. Scope

### Included

- Monitoring kit as specified
- Autoconnecto tenant, transformer dashboard, and alarm rules
- Training session (remote, 90 minutes) for your service engineers
- Documentation: wiring, Modbus map, dashboard use

### Not included (unless ordered)

- Transformer, HV/LV bushings, or any change to your electrical design
- Oil / winding temperature or Buchholz sensors
- Civil work, yard earthing upgrades, or DISCOM liaison
- SIM cards and mobile data
- 11 kV / 33 kV primary-side metering
- Custom white-label (Enterprise plan)

---

## 6. Implementation

| Week | Activity |
|---|---|
| 1 | Kick-off, rating mix, SIM policy, sample nameplate data |
| 2 | Kit assembly and factory acceptance on a 100 kVA (or your available unit) |
| 3 | Dashboard login for your team; alarm-limit training |
| 4–6 | Pilot sites live; weekly review |
| Thereafter | Production kits against your dispatch schedule |

A factory-fit kit is designed so your electrician can mount the enclosure on the LV side, land three CTs, and power the 5 V supply from a small LV auxiliary. We provide a one-page work instruction.

---

## 7. Assumptions

- LV is 415 V, 3-phase, 4-wire, 50 Hz (433 V also supported; we set voltage limits accordingly).
- CTs are installed on the LV bushings or LV cable, not on the 11 kV side.
- 4G coverage exists at the yard. If not, we will quote a different backhaul.
- You provide a mounting location, LV auxiliary, and a safe isolation window for CT fitment.
- Autoconnecto is used as a multi-tenant SaaS. Data stays in your tenant.

---

## 8. Commercial terms (draft)

- 50% with PO, 50% before dispatch of kits (pilot: 100% with PO is acceptable).
- Platform billed annually in advance after the pilot window.
- Warranty on kit electronics: 24 months against manufacturing defect. CTs and enclosure: 12 months. Not covered: lightning, water ingress from open glands, SIM/network, or incorrect CT polarity left uncorrected.
- Payment: NEFT / RTGS. Delayed payment pauses new dispatches, not live dashboards already paid.
- This document is a proposal, not a tax invoice.

---

## 9. Why this approach

- **One kit family** — only CTs change across your catalogue.
- **Your brand can sit in front** on Enterprise (white-label).
- **Limits belong to the operator**, not to a firmware version.
- **Same cloud** if you later add oil temperature, energy billing, or a customer portal.
- You have already proven the field path: ESP32, Indian RS485 meter, CTs, 4G hotspot. This proposal productises that path.

---

## 10. Next step

Please confirm:

1. Pilot of five ratings, or a single rating first?
2. Factory-fit, site retrofit, or both?
3. Who supplies the SIM?
4. Legal name, GSTIN, and billing address for the formal quote / PO.

We can run a live Autoconnecto demo of a 100 kVA transformer (simulated, then your yard) in the same week as your go-ahead.

**Autoconnecto**  
Real-time industrial monitoring  
[your email] · [your phone]
