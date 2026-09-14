# Autoconnecto Factory Floor — Customer Pilot Guide

**Machine Runtime (dual ESP) · Worker app · Cloud dashboard**  
**Audience:** Site supervisors, plant admins, and operators  
**Status:** Pilot  

---

## 1. What you received

This pilot package connects a **machine press** to Autoconnecto so you can:

- See live electrical load and count **product cycles**
- Let operators **Start / End shift** and record **jobs** from a phone (Bluetooth)
- Track **efficiency**, **worker activity**, and optional **tool life**
- Manage machines from the **Factory Floor** cloud dashboard

### System pieces

| Piece | What it does |
|--------|----------------|
| **Wi‑Fi ESP board** (inside the machine enclosure) | Connects to your shop Wi‑Fi and Autoconnecto cloud; reads current (PZEM); controls machine enable (SSR); stores cycle counts |
| **BLE ESP board** (paired with Wi‑Fi board) | Bluetooth radio for the worker phone only |
| **Android Worker app** | Operator Start / End shift and job + / − (Bluetooth only — no cloud login on the phone) |
| **Factory Floor dashboard** | Supervisors monitor floors, configure machines, reset tool life / counters |

```
  [ Worker phone ]  --Bluetooth-->  [ BLE ESP ]  --UART-->  [ Wi‑Fi ESP ]  --Wi‑Fi/MQTT-->  [ Autoconnecto cloud ]
                                                                          |
                                                                   [ PZEM sensor ]
                                                                   [ SSR / enable ]
```

---

## 2. What works on this pilot

- Live amps / volts / power on the dashboard when the machine is online  
- Electrical **load cycles** (product cycles) on Day / Week / Month / Year  
- Worker **jobs** counted from the phone **+** / **−** buttons  
- **This login** vs **period** (Today / Week / …) views  
- Efficiency when **expected cycles per hour** is configured  
- Optional **tool life** (blocks machine when job limit is reached)  
- Admin **Clear data & reset** on the Wi‑Fi board from the cloud  
- **Over‑the‑air (OTA) firmware** updates for the **Wi‑Fi board only** (arranged by Autoconnecto)

### Limits for this pilot

- **BLE board** firmware cannot be updated over the air; a site visit or USB is required if that firmware must change  
- Shop Wi‑Fi **SSID / password** are programmed into the Wi‑Fi board before delivery — they must match the network on site  
- Worker app is **Android** (Bluetooth + Location required)  
- This is a **pilot**: treat results as production-assist, and escalate issues to your Autoconnecto contact  

---

## 3. On-site checklist (before operators start)

1. Machine panel powered; both ESP boards powered.  
2. Shop Wi‑Fi is the network programmed into the device (already matched for your site).  
3. On the dashboard, the machine shows **online** (Factory Floor → Machines).  
4. Physical label on the machine matches the Bluetooth name (**AC-001**, **AC-007**, etc.).  
5. At least one Android phone has the **Autoconnecto Worker** app installed.  
6. A supervisor account can open **Factory Floor → Setup**.  

---

## 4. Worker phone app (operators)

### Install

- Prefer: Autoconnecto web app (logged in) → top bar → **Worker app**  
- Or use the APK provided by your Autoconnecto contact  

Allow **Bluetooth**, **Location**, and (if asked) **Nearby devices** / notifications.

### First-time setup

1. Enter your **Worker ID** and **Name** (saved on the phone until you edit profile).  
2. Scan and **pin** your machine (**AC-###**). Assignment stays until **Change machine**.  
3. Stand close to the machine (~2 m) while scanning if needed.  

### Shift

| Action | Result |
|--------|--------|
| **START SESSION** (or **RESUME SESSION**) | Session starts; machine enable can close when policy allows |
| **+** / **−** | Adds or removes a **worker job** for this shift |
| **End shift** | Ends session; job count for the shift closes; **machine pin stays** |
| **Change machine** | Unpins this press so you can pick another |

### Rules operators should know

- Only **one active operator** at a time on a machine (“Machine in use”).  
- If Bluetooth drops briefly (call, walking away), the app tries to **reconnect**; your session is normally kept.  
- If the screen says the **tool limit** is reached, stop and ask a supervisor to replace the tool and **Reset tool life** in Setup.  
- Do **not** share worker IDs; each person should use their own ID.  

---

## 5. Factory Floor dashboard (supervisors)

Open Autoconnecto → your dashboard with the **Factory Floor** widget.

### Tabs

| Tab | Use for |
|-----|---------|
| **Overview** | Fleet summary, session hours, efficiency highlights |
| **Machines** | Live status per machine: load, cycles, jobs, tool left |
| **Workers** | Activity while workers are logged in (hours / cycles for efficiency) |
| **Setup** | Add / edit machines, thresholds, expected output, tool life, admin resets |

### Time periods

Choose **Day / Week / Month / Year** (Day can be Today or Yesterday).  
Periods use **India Standard Time (IST)**; weeks start **Monday 00:00 IST**.

### Understanding the numbers

| Metric | Meaning |
|--------|---------|
| **Cycles (Today / Week / …)** | Electrical **product cycles** from current pattern on the sensor |
| **This login** | Cycles since the current worker session started |
| **Lifetime on device** | Lifetime electrical cycles stored on the Wi‑Fi board |
| **Worker jobs** | Counts from the phone **+** / **−** (this session / period as shown) |
| **Efficiency** | Load cycles vs expected (needs **Expected load cycles / hour** in Setup) |
| **Tool left** | Remaining jobs before tool change (if tool life is enabled) |

**Important:** Efficiency uses **electrical load cycles while someone is logged in**, not the job + / − buttons.

### Cycle definition (threshold type)

Configured per machine in Setup:

- **2-level:** Off → On load → Off = **1 cycle**  
- **3-level:** On → On load → On = **1 cycle**  

---

## 6. Setup (tenant admin / owner)

Factory Floor → **Setup**.

### Add a machine

- **Create machine** — new device + defaults, or  
- **Link existing device** — attach a device already on your tenant  

Setup assigns:

- Display name  
- Machine **code** and Bluetooth slot → name **AC-###**  
- Load thresholds (amps)  
- Optional expected cycles/hour and tool life  

### Edit machine

- Update name, thresholds, expected cycles/hour, tool life  
- Copy **Device token (ESP)** if Autoconnecto asks you to re‑flash (rare during pilot)  

### Reset tool life (after physical tool change)

1. Replace the tool on the machine.  
2. Setup → Edit machine → **Reset tool life**.  
3. Machine can run again once the board syncs (usually within about a minute; BLE reconnect helps).  

### Clear data & reset ESP (admin only)

Use when you want a clean counter baseline for demos or trials:

1. Ask the operator to **End shift** if someone is logged in.  
2. Setup → Edit machine → **Clear data & reset ESP**.  
3. Confirms wipe of platform Day/Week/Month/Year cycle **and** job period counters, and clears **lifetime** on the Wi‑Fi board.  
4. Does **not** change tool-life settings.  
5. **Cannot be undone.**  

---

## 7. Remote support & firmware updates

| Board | Update method |
|-------|----------------|
| **Wi‑Fi ESP** | Autoconnecto can push firmware **OTA** from the cloud (board must be online) |
| **BLE ESP** | USB / on-site only for this pilot |

Keep the machine powered and on Wi‑Fi when Autoconnecto schedules an OTA.

---

## 8. Everyday troubleshooting

| Symptom | What to try |
|---------|-------------|
| Machine **offline** on dashboard | Check power, shop Wi‑Fi, antenna; wait 1–2 minutes; contact Autoconnecto if still down |
| Phone cannot find **AC-###** | Bluetooth + Location on; stand close; Scan again; confirm BLE board is powered |
| **Machine in use** | Current operator must **End shift** or **Resume**; another ID cannot take over mid-session |
| Jobs wrong but cycles look fine | Jobs come only from **+ / −** on the app — check who pressed what |
| Cycles look wrong | Confirm load thresholds and that PZEM/sensor wiring was not disturbed |
| Tool blocked / SSR open | Supervisor: physical tool change → **Reset tool life** |
| After counter reset, lifetime not zero | Machine must be **online** when Clear & reset is pressed; try again or call support |
| App disconnects often | Keep phone unlocked/nearby during shift; allow background/notification permission |

---

## 9. Safety & responsibility

- Electrical installation and SSR / contactor wiring must be done by a **qualified electrician**.  
- Autoconnecto controls an **enable** path; plant lockout / tagout and local safety rules still apply.  
- Do not share device tokens or admin passwords.  
- This pilot assists visibility and counting; process ownership remains with the plant.  

---

## 10. Quick reference cards

### Operator (30 seconds)

1. Open Worker app → confirm your name.  
2. Confirm pinned machine **AC-###**.  
3. **START SESSION** → work → **+** each completed job as trained.  
4. **End shift** when done.  

### Supervisor (30 seconds)

1. Open Factory Floor → **Machines**.  
2. Check online / load / cycles / jobs.  
3. Tool expired → Setup → **Reset tool life**.  
4. Need clean counters → End shift → Setup → **Clear data & reset ESP**.  

---

## 11. Support

Contact your **site supervisor / tenant admin**, or your **Autoconnecto support contact**, with:

- Machine name / **AC-###**  
- Approximate time of the issue  
- What you saw on the phone and on the dashboard  
- Photo of the status screen if useful  

---

*Document for customer pilot use · Autoconnecto Factory Floor (Machine Runtime dual‑ESP)*  
*Network cloud endpoints used by the Wi‑Fi board: `mqtt.autoconnecto.in`, `api.autoconnecto.in`*
