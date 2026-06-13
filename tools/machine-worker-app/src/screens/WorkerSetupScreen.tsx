import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { WorkerProfile } from "../config/storage";
import { colors, spacing } from "../config/theme";
import { useWorker } from "../context/WorkerContext";

type Props = {
  initialProfile?: WorkerProfile | null;
};

export function WorkerSetupScreen({ initialProfile = null }: Props) {
  const { saveProfile, cancelProfileEdit } = useWorker();
  const isEdit = Boolean(initialProfile);
  const [workerId, setWorkerId] = useState(initialProfile?.workerId ?? "");
  const [workerName, setWorkerName] = useState(initialProfile?.workerName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialProfile) {
      setWorkerId(initialProfile.workerId);
      setWorkerName(initialProfile.workerName);
    }
  }, [initialProfile]);

  async function onSave() {
    const id = workerId.trim();
    const name = workerName.trim();
    if (!id || !name) {
      setError("Enter your worker ID and name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveProfile({ workerId: id, workerName: name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.brand}>Autoconnecto Worker</Text>
          <Text style={styles.title}>{isEdit ? "Edit profile" : "Worker profile"}</Text>
          <Text style={styles.subtitle}>
            {isEdit
              ? "Update your ID or name. Saved on this phone until you edit again."
              : "Set once — your name is sent to the machine over Bluetooth when you start a session."}
          </Text>

          <Text style={styles.label}>Worker ID</Text>
          <TextInput
            value={workerId}
            onChangeText={setWorkerId}
            style={styles.input}
            placeholder="e.g. W12"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={workerName}
            onChangeText={setWorkerName}
            style={styles.input}
            placeholder="Rajesh Kumar"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={onSave}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isEdit ? "Save changes" : "Continue"}</Text>
            )}
          </Pressable>

          {isEdit ? (
            <Pressable style={styles.cancelBtn} onPress={cancelProfileEdit} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: colors.bgCard, borderRadius: 20, padding: spacing.lg },
  brand: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.textMuted, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
    fontSize: 16,
    backgroundColor: colors.bgMuted,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancelBtn: { marginTop: spacing.md, alignItems: "center" },
  cancelText: { color: colors.textMuted, fontWeight: "600" },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
