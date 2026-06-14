import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  friendlyBleError,
  scanNearbyMachinesDetailed,
  type ScannedMachine,
} from "../ble/workerBle";
import { colors, spacing } from "../config/theme";
import { useWorker } from "../context/WorkerContext";

export function PickMachineScreen() {
  const { profile, pinMachine, startProfileEdit, machinePickNonce } = useWorker();
  const [machines, setMachines] = useState<ScannedMachine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "resolving" | "done">("idle");
  const [pinning, setPinning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const failStreakRef = useRef(0);
  const scanGenerationRef = useRef(0);

  const scan = useCallback(
    async (options?: { resetManager?: boolean }) => {
      if (scanning) return;
      const generation = ++scanGenerationRef.current;
      setScanning(true);
      setScanPhase("scanning");
      setError("");

      const resetManager = options?.resetManager ?? failStreakRef.current >= 1;

      try {
        const { machines: rows, serviceHits } = await scanNearbyMachinesDetailed({
          resetManager,
          onProgress: (progress) => {
            if (generation !== scanGenerationRef.current) return;
            setScanPhase(progress.phase);
            if (progress.machines.length) {
              setMachines(progress.machines);
            }
          },
        });

        if (generation !== scanGenerationRef.current) return;

        setMachines(rows);
        setScanPhase("done");

        if (!rows.length) {
          failStreakRef.current += 1;
          const serviceHint =
            serviceHits > 0
              ? ` Detected ${serviceHits} machine radio(s) but could not read AC-### — move closer and tap Scan again.`
              : "";
          setError(
            `No machines found.${serviceHint} Check Bluetooth + Location ON, ESP serial shows [BLE] advertising AC-001, stand within 2 m.`
          );
        } else {
          failStreakRef.current = 0;
        }
      } catch (err) {
        if (generation !== scanGenerationRef.current) return;
        failStreakRef.current += 1;
        setError(friendlyBleError(err, "Scan failed"));
        setMachines([]);
        setScanPhase("done");
      } finally {
        if (generation === scanGenerationRef.current) {
          setScanning(false);
        }
      }
    },
    [scanning]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void scan({ resetManager: false });
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      scanGenerationRef.current += 1;
    };
  }, [machinePickNonce]);

  async function onPick(item: ScannedMachine) {
    setPinning(item.bleAdvertName);
    setError("");
    try {
      await pinMachine({
        bleAdvertName: item.bleAdvertName,
        deviceId: item.deviceId,
      });
      failStreakRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select machine");
    } finally {
      setPinning(null);
    }
  }

  const scanLabel =
    scanPhase === "resolving"
      ? "Identifying…"
      : scanning
        ? "Scanning…"
        : "Scan again";

  const appVersion = Constants.expoConfig?.version ?? "dev";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.brand}>Autoconnecto Worker</Text>
          <Text style={styles.version}>v{appVersion}</Text>
          <Text style={styles.title}>Select your machine</Text>
          <Text style={styles.subtitle}>
            {profile?.workerName} ({profile?.workerId}) — pick the floor label on the press (AC-001,
            AC-002…). Saved on this phone until you change machine.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.scanBtn, scanning && styles.scanBtnActive]}
            onPress={() => scan({ resetManager: failStreakRef.current >= 1 })}
            disabled={scanning}
          >
            {scanning ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            <Text style={styles.scanBtnText}>{scanLabel}</Text>
          </Pressable>
          <Pressable onPress={startProfileEdit}>
            <Text style={styles.link}>Edit profile</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {scanning && !machines.length ? (
          <View style={styles.scanningBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.scanningText}>Looking for AC-001, AC-002…</Text>
          </View>
        ) : null}

        <FlatList
          data={machines}
          keyExtractor={(item) => item.deviceId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !scanning ? (
              <Text style={styles.empty}>No machines yet. Stand near your press and tap Scan again.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onPick(item)}
              disabled={pinning === item.bleAdvertName}
            >
              <View style={styles.rowIcon}>
                <Text style={styles.rowIconText}>⚙</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.bleAdvertName}</Text>
                <Text style={styles.rowMeta}>
                  Signal {item.rssi ?? "—"} dBm · tap to assign this press
                </Text>
              </View>
              {pinning === item.bleAdvertName ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.select}>Select</Text>
              )}
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  brand: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  version: { color: "#64748b", fontSize: 10, fontWeight: "600", marginBottom: spacing.xs },
  title: { fontSize: 26, fontWeight: "800", color: colors.textOnDark },
  subtitle: { marginTop: spacing.sm, color: "#94a3b8", lineHeight: 22 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 130,
    justifyContent: "center",
  },
  scanBtnActive: { opacity: 0.85 },
  scanBtnText: { fontWeight: "700", color: colors.text },
  link: { color: "#93c5fd", fontWeight: "700" },
  error: { color: "#fecaca", paddingHorizontal: spacing.lg, marginBottom: spacing.sm, lineHeight: 20 },
  scanningBox: { alignItems: "center", marginTop: spacing.xl, gap: spacing.md },
  scanningText: { color: "#94a3b8" },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: spacing.lg, lineHeight: 22 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { opacity: 0.92 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  rowMeta: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  select: { color: colors.primary, fontWeight: "800", fontSize: 14 },
});
