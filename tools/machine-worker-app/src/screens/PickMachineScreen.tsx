import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { scanNearbyMachines, type ScannedMachine } from "../ble/workerBle";
import { useWorker } from "../context/WorkerContext";

export function PickMachineScreen() {
  const { profile, pinMachine, logout } = useWorker();
  const [machines, setMachines] = useState<ScannedMachine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);
  const [error, setError] = useState("");

  const scan = useCallback(async () => {
    setScanning(true);
    setError("");
    try {
      const rows = await scanNearbyMachines(12000);
      setMachines(rows);
      if (!rows.length) {
        setError(
          "No AC-### machines found nearby. Check: (1) phone Bluetooth on, (2) app permissions (Nearby devices + Location), (3) ESP serial shows [BLE] advertising as AC-001, (4) floor label matches slot (slot 1 → AC-001)."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setMachines([]);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  async function onPick(item: ScannedMachine) {
    setPinning(item.bleAdvertName);
    setError("");
    try {
      await pinMachine({
        bleAdvertName: item.bleAdvertName,
        deviceId: item.deviceId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pin machine");
    } finally {
      setPinning(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>My machine</Text>
        <Text style={styles.subtitle}>
          {profile?.workerName} ({profile?.workerId}) — tick the machine matching the floor label
          (e.g. AC-001).
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.scanBtn} onPress={scan} disabled={scanning}>
          <Text style={styles.scanBtnText}>{scanning ? "Scanning…" : "Scan again"}</Text>
        </Pressable>
        <Pressable onPress={logout}>
          <Text style={styles.link}>Logout</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {scanning && !machines.length ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}

      <FlatList
        data={machines}
        keyExtractor={(item) => item.bleAdvertName}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => onPick(item)}
            disabled={pinning === item.bleAdvertName}
          >
            <View>
              <Text style={styles.rowTitle}>{item.bleAdvertName}</Text>
              <Text style={styles.rowMeta}>
                Signal {item.rssi ?? "—"} dBm · tap to pin for this shift
              </Text>
            </View>
            {pinning === item.bleAdvertName ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.tick}>✓</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { marginTop: 6, color: "#64748b", lineHeight: 20 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scanBtn: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanBtnText: { fontWeight: "600", color: "#334155" },
  link: { color: "#2563eb", fontWeight: "600" },
  error: { color: "#dc2626", paddingHorizontal: 16, marginBottom: 8 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  rowMeta: { marginTop: 4, color: "#64748b", fontSize: 12 },
  tick: { fontSize: 22, color: "#2563eb", fontWeight: "700" },
});
