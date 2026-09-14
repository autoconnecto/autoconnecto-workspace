# Demo setup — Distribution Transformer Monitoring

Use this when you show Autoconnecto to the transformer OEM. The data generator is the demo path. Hardware is for the live pilot later.

## 1. Create the device profile

1. Open **Device profiles → Create**.
2. Name: `Distribution Transformer`. Type: `distribution_transformer`.
3. Open the new profile → **Alarms**.
4. Recreate the rules from `autoconnecto/device-profile.json` (or paste the `alarms` array if your tenant API allows a profile update).
5. Each numeric band has a **Limit attribute** (for example `voltage_high_ln`). The number next to it is only the fallback if the attribute is missing.

## 2. Create the demo device

1. **Devices → Create**.
2. Name: `DT-100kVA-Demo`.
3. Profile: Distribution Transformer.
4. Note the device id.

## 3. Set shared attributes (alarm limits)

On the device, set **Shared** attributes from `autoconnecto/shared-attributes.json`:

| Key | 100 kVA default |
|---|---|
| `rated_kva` | 100 |
| `voltage_high_ln` | 253 |
| `voltage_low_ln` | 216 |
| `current_high` | 150 |
| `load_pct_high` | 90 |
| `pf_low` | 0.8 |
| `freq_high` | 51.5 |
| `freq_low` | 48.5 |
| `imbalance_pct_high` | 20 |

For other ratings change `rated_kva` and `current_high`:

| kVA | `current_high` |
|---|---|
| 25 | 50 |
| 63 | 100 |
| 100 | 150 |
| 250 | 400 |
| 500 | 800 |

## 4. Import the dashboard

1. **Dashboards → Import**.
2. Select `autoconnecto/dashboard.json`.
3. Open the imported dashboard.
4. In the dashboard device picker, select `DT-100kVA-Demo`.

The **Alarm limits** widget is an Attribute Control Card. Saving a value there updates the shared attribute. Platform alarms use that value on the next telemetry sample.

## 5. Start the data generator

1. **Rule chains → Create**.
2. Copy fields from `autoconnecto/data-generator.json`, or create a generator and add the same keys.
3. Set **target device** to `DT-100kVA-Demo`.
4. Interval: 5 seconds.
5. **Start**.

You should see live 3-phase voltage, current, kW, kVA, PF, Hz, kWh, load %, and imbalance.

## 6. Demo script (about 4 minutes)

1. Show the overview widget: R/Y/B voltage and current, load bar, health chip.
2. Show KPI tiles and analog meters.
3. Open **Alarm limits**. Lower `voltage_high_ln` from 253 to 235. Wait 10–15 seconds. Overvoltage alarms should appear.
4. Put the limit back to 253. Alarms clear after the hold time.
5. Lower `load_pct_high` to 60 to show overload.
6. Pause the generator for 3 minutes to show **Communication loss** (or temporarily set no-update to 30 s for a faster demo).

## 7. After the meeting

- Leave the generator running if they want a login to explore.
- For a yard pilot, flash the ESP32 against the same telemetry keys (`dt_v_r`, `dt_i_r`, …) from the RS485 meter. Key names stay the same so this dashboard does not change.
