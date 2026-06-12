import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useWorker } from "../context/WorkerContext";
import { usePinnedMachineConnection } from "../hooks/usePinnedMachineConnection";
import { isMachineBusyForWorker, isSessionOwnedByWorker } from "../ble/workerBle";
import { savePinnedMachine } from "../config/storage";

export function ShiftScreen() {
  const { profile, pinned, clearPin, logout, pinMachine } = useWorker();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const onDeviceId = useCallback(
    async (deviceId: string) => {
      if (!pinned || pinned.deviceId === deviceId) return;
      const next = { ...pinned, deviceId };
      await savePinnedMachine(next);
      await pinMachine(next);
    },
    [pinned, pinMachine]
  );

  const { phase, status, error, sendCommand, reconnect } = usePinnedMachineConnection({
    pinned,
    enabled: Boolean(pinned),
    onDeviceId,
  });

  const workerId = profile?.workerId || "";
  const sessionMine = isSessionOwnedByWorker(status, workerId);
  const machineBusy = isMachineBusyForWorker(status, workerId);
  const sessionOn = Boolean(status?.session && sessionMine);

  async function onStartOrResume() {
    if (!profile) return;
    setBusy(true);
    setActionError("");
    try {
      await sendCommand({
        cmd: "start",
        operator_id: profile.workerId,
        operator_name: profile.workerName,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }

  async function onJobAdd() {
    setBusy(true);
    setActionError("");
    try {
      await sendCommand({ cmd: "job_add" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not add job");
    } finally {
      setBusy(false);
    }
  }

  async function onJobRemove() {
    setBusy(true);
    setActionError("");
    try {
      await sendCommand({ cmd: "job_remove" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not undo job");
    } finally {
      setBusy(false);
    }
  }

  async function stopSessionOnDevice() {
    if (!sessionOn) return;
    try {
      await sendCommand({ cmd: "stop" });
    } catch {
      /* best effort before end shift */
    }
  }

  async function onEndShift() {
    Alert.alert("End shift?", "This stops your session and unpins the machine.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End shift",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await stopSessionOnDevice();
          await clearPin();
          setBusy(false);
        },
      },
    ]);
  }

  async function onChangeMachine() {
    Alert.alert("Change machine?", "End this machine pin and pick another press.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Change",
        onPress: async () => {
          setBusy(true);
          await stopSessionOnDevice();
          await clearPin();
          setBusy(false);
        },
      },
    ]);
  }

  function onLogout() {
    Alert.alert("Logout?", "Clears your worker profile and machine pin.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          await stopSessionOnDevice();
          await logout();
          setBusy(false);
        },
      },
    ]);
  }

  const linkLabel =
    phase === "connected"
      ? "Connected"
      : phase === "connecting"
        ? "Connecting…"
        : phase === "reconnecting"
          ? "Reconnecting…"
          : phase === "error"
            ? "Link lost — retrying"
            : "Idle";

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.machine}>{pinned?.bleAdvertName}</Text>
        <Text style={styles.worker}>
          {profile?.workerName} · {profile?.workerId}
        </Text>
        <View style={styles.linkRow}>
          <View
            style={[
              styles.linkDot,
              phase === "connected" ? styles.linkOk : styles.linkPending,
            ]}
          />
          <Text style={styles.linkText}>{linkLabel}</Text>
          {phase !== "connected" ? (
            <Pressable onPress={() => reconnect()}>
              <Text style={styles.linkAction}>Retry now</Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.statusGrid}>
          <Chip label="Session" value={sessionOn ? "ON" : "OFF"} ok={sessionOn} />
          <Chip label="Jobs" value={String(status?.jobs ?? 0)} />
          <Chip
            label="Allow run"
            value={status?.allow_run === false ? "BLOCKED" : "OK"}
            ok={status?.allow_run !== false}
          />
        </View>

        {machineBusy ? (
          <Text style={styles.busy}>
            Machine in use by {status?.operator_name || status?.operator_id || "another worker"}
          </Text>
        ) : null}

        {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

        {phase !== "connected" ? (
          <Text style={styles.hint}>
            BLE will reconnect automatically — no need to pick the machine again.
          </Text>
        ) : null}

        {phase === "connected" && !sessionOn && !machineBusy ? (
          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={onStartOrResume}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>
              {status?.session ? "RESUME SESSION" : "START SESSION"}
            </Text>
          </Pressable>
        ) : null}

        {phase === "connected" && sessionOn ? (
          <>
            <Pressable
              style={[styles.jobBtn, busy && styles.btnDisabled]}
              onPress={onJobAdd}
              disabled={busy}
            >
              <Text style={styles.jobBtnText}>+ ONE MORE JOB</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
              onPress={onJobRemove}
              disabled={busy}
            >
              <Text style={styles.secondaryBtnText}>Undo last job</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.footerActions}>
          <Pressable onPress={onChangeMachine} disabled={busy}>
            <Text style={styles.footerLink}>Change machine</Text>
          </Pressable>
          <Pressable onPress={onEndShift} disabled={busy}>
            <Text style={styles.footerLinkDanger}>End shift</Text>
          </Pressable>
          <Pressable onPress={onLogout} disabled={busy}>
            <Text style={styles.footerLink}>Logout</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      </View>
    </View>
  );
}

function Chip({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, ok === false ? styles.chipBad : ok ? styles.chipGood : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  top: { marginBottom: 16 },
  machine: { color: "#fff", fontSize: 32, fontWeight: "800" },
  worker: { color: "#94a3b8", marginTop: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  linkDot: { width: 10, height: 10, borderRadius: 5 },
  linkOk: { backgroundColor: "#22c55e" },
  linkPending: { backgroundColor: "#f59e0b" },
  linkText: { color: "#cbd5e1", fontSize: 13 },
  linkAction: { color: "#93c5fd", fontWeight: "600", fontSize: 13 },
  errorBanner: { color: "#fecaca", marginTop: 8, fontSize: 12 },
  panel: { backgroundColor: "#fff", borderRadius: 16, padding: 16, flex: 1 },
  statusGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: 10, padding: 10 },
  chipLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  chipValue: { marginTop: 4, fontSize: 18, fontWeight: "800", color: "#0f172a" },
  chipGood: { color: "#15803d" },
  chipBad: { color: "#dc2626" },
  busy: { color: "#dc2626", marginBottom: 10, fontWeight: "600" },
  actionError: { color: "#dc2626", marginBottom: 8 },
  hint: { color: "#64748b", fontSize: 12, marginBottom: 12, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  jobBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 10,
  },
  jobBtnText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  footerActions: { marginTop: 16, gap: 12 },
  footerLink: { color: "#2563eb", fontWeight: "600", textAlign: "center" },
  footerLinkDanger: { color: "#dc2626", fontWeight: "700", textAlign: "center" },
});
