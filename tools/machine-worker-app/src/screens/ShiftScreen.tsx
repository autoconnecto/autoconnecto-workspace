import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JobCounter } from "../components/JobCounter";
import {
  friendlyBleError,
  isMachineBusyForWorker,
  isSessionOwnedByWorker,
} from "../ble/workerBle";
import { colors, spacing } from "../config/theme";
import { savePinnedMachine } from "../config/storage";
import { useWorker } from "../context/WorkerContext";
import { usePinnedMachineConnection } from "../hooks/usePinnedMachineConnection";

export function ShiftScreen() {
  const { profile, pinned, changeMachine, startProfileEdit, pinMachine } = useWorker();
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
  const jobCount = status?.jobs ?? 0;
  const allowBlocked = status?.allow_run === false;
  const connected = phase === "connected";

  async function onStartOrResume() {
    if (!profile) return;
    setBusy(true);
    setActionError("");
    try {
      const latest = await sendCommand({
        cmd: "start",
        operator_id: profile.workerId,
        operator_name: profile.workerName,
      });
      if (!isSessionOwnedByWorker(latest, profile.workerId)) {
        if (latest?.allow_run === false) {
          setActionError("Machine blocked (allow-run off). Ask supervisor in dashboard Setup.");
        } else if (latest?.session_busy || latest?.session) {
          setActionError(
            `In use by ${latest?.operator_name || latest?.operator_id || "another worker"}.`
          );
        } else {
          setActionError("Session did not start. Check ESP is powered and serial log shows BLE ready.");
        }
      }
    } catch (err) {
      setActionError(friendlyBleError(err, "Start failed"));
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
      setActionError(friendlyBleError(err, "Could not add job"));
    } finally {
      setBusy(false);
    }
  }

  async function onJobRemove() {
    if (jobCount <= 0) return;
    setBusy(true);
    setActionError("");
    try {
      await sendCommand({ cmd: "job_remove" });
    } catch (err) {
      setActionError(friendlyBleError(err, "Could not remove job"));
    } finally {
      setBusy(false);
    }
  }

  async function stopSessionOnDevice() {
    if (!connected) {
      throw new Error("Not connected yet. Wait for Connected (green dot) or tap Retry.");
    }
    if (!status?.session && !sessionOn) return;
    const latest = await sendCommand({ cmd: "stop" });
    if (latest?.session) {
      throw new Error("Session still active on machine. Tap Retry, then End shift again.");
    }
  }

  async function onEndShift() {
    Alert.alert(
      "End shift?",
      "Stops your session on the machine. Your assigned press (AC-###) stays saved on this phone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End shift",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setActionError("");
            try {
              await stopSessionOnDevice();
            } catch (err) {
              setActionError(friendlyBleError(err, "Could not end shift"));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  async function onChangeMachine() {
    Alert.alert(
      "Change machine?",
      "Stops the current session and opens machine scan. Use when you move to another press.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change machine",
          onPress: async () => {
            setBusy(true);
            setActionError("");
            try {
              if (connected && (status?.session || sessionOn)) {
                await sendCommand({ cmd: "stop" });
              }
            } catch {
              /* continue — changeMachine resets BLE anyway */
            }
            await changeMachine();
            setBusy(false);
          },
        },
      ]
    );
  }

  const linkLabel =
    phase === "connected"
      ? "Connected"
      : phase === "connecting"
        ? "Connecting…"
        : phase === "reconnecting"
          ? "Reconnecting…"
          : phase === "error"
            ? "Reconnecting…"
            : "Connecting…";

  const stepHint = !connected
    ? "Step 1: Wait for Connected (green dot). Stand within 2 m of the ESP. Tap Retry if stuck."
    : !sessionOn && !machineBusy
      ? "Step 2: Tap START SESSION below. Step 3: Use + / − to count jobs."
      : sessionOn
        ? "Session active — tap + after each job."
        : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.brand}>Autoconnecto Worker</Text>
          <Text style={styles.machine}>{pinned?.bleAdvertName}</Text>
          <Text style={styles.worker}>
            {profile?.workerName} · {profile?.workerId}
          </Text>
          <View style={styles.linkRow}>
            <View
              style={[
                styles.linkDot,
                connected ? styles.linkOk : styles.linkPending,
              ]}
            />
            <Text style={styles.linkText}>{linkLabel}</Text>
            {!connected ? (
              <Pressable onPress={() => reconnect()}>
                <Text style={styles.linkAction}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.errorBanner}>{friendlyBleError(error)}</Text> : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.statusGrid}>
            <StatusTile label="Session" value={sessionOn ? "ON" : "OFF"} tone={sessionOn ? "ok" : "neutral"} />
            <StatusTile
              label="Allow run"
              value={allowBlocked ? "BLOCKED" : "OK"}
              tone={allowBlocked ? "bad" : "ok"}
            />
            <StatusTile label="Jobs" value={String(jobCount)} tone="neutral" />
          </View>

          {stepHint ? <Text style={styles.hint}>{stepHint}</Text> : null}

          {allowBlocked ? (
            <Text style={styles.blockedHint}>
              Machine blocked by admin (tool life or allow-run). Ask supervisor to reset in dashboard Setup.
            </Text>
          ) : null}

          {machineBusy ? (
            <Text style={styles.busy}>
              In use by {status?.operator_name || status?.operator_id || "another worker"}
            </Text>
          ) : null}

          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

          {connected && !sessionOn && !machineBusy ? (
            <Pressable
              style={[styles.primaryBtn, (busy || allowBlocked) && styles.btnDisabled]}
              onPress={onStartOrResume}
              disabled={busy || allowBlocked}
            >
              <Text style={styles.primaryBtnText}>
                {status?.session ? "RESUME SESSION" : "START SESSION"}
              </Text>
            </Pressable>
          ) : null}

          {connected && sessionOn ? (
            <JobCounter
              count={jobCount}
              onIncrement={onJobAdd}
              onDecrement={onJobRemove}
              disabled={busy}
              busy={busy}
            />
          ) : null}

          <View style={styles.footerActions}>
            <Pressable
              style={[styles.footerBtn, (!connected || busy) && styles.footerBtnDisabled]}
              onPress={onEndShift}
              disabled={busy}
            >
              <Text style={styles.footerBtnText}>End shift</Text>
            </Pressable>
            <Pressable style={styles.footerBtn} onPress={onChangeMachine} disabled={busy}>
              <Text style={styles.footerBtnText}>Change machine</Text>
            </Pressable>
            <Pressable style={styles.footerBtn} onPress={startProfileEdit} disabled={busy}>
              <Text style={styles.footerBtnText}>Edit profile</Text>
            </Pressable>
          </View>

          {busy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "neutral";
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text
        style={[
          styles.tileValue,
          tone === "ok" ? styles.tileOk : tone === "bad" ? styles.tileBad : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, padding: spacing.md },
  top: { marginBottom: spacing.md },
  brand: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  machine: { color: colors.textOnDark, fontSize: 34, fontWeight: "800" },
  worker: { color: "#94a3b8", marginTop: spacing.xs, fontSize: 15 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  linkDot: { width: 10, height: 10, borderRadius: 5 },
  linkOk: { backgroundColor: colors.success },
  linkPending: { backgroundColor: colors.warning },
  linkText: { color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  linkAction: { color: "#93c5fd", fontWeight: "700", fontSize: 13 },
  errorBanner: { color: "#fecaca", marginTop: spacing.sm, fontSize: 12, lineHeight: 18 },
  panel: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: spacing.lg,
    flex: 1,
  },
  statusGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: "center",
  },
  tileLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  tileValue: { marginTop: spacing.xs, fontSize: 18, fontWeight: "800", color: colors.text },
  tileOk: { color: colors.successDark },
  tileBad: { color: colors.danger },
  blockedHint: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
    backgroundColor: "#fef2f2",
    padding: spacing.sm,
    borderRadius: 10,
  },
  busy: { color: colors.danger, marginBottom: spacing.sm, fontWeight: "700" },
  actionError: { color: colors.danger, marginBottom: spacing.sm, fontWeight: "600" },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
    lineHeight: 20,
    backgroundColor: colors.bgMuted,
    padding: spacing.sm,
    borderRadius: 10,
  },
  primaryBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.55 },
  footerActions: {
    marginTop: "auto",
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  footerBtn: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: colors.bgMuted,
  },
  footerBtnDisabled: { opacity: 0.6 },
  footerBtnText: { color: colors.text, fontWeight: "700", fontSize: 14 },
});
