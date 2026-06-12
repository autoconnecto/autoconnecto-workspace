import { useState } from "react";
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
import { useWorker } from "../context/WorkerContext";

export function WorkerSetupScreen() {
  const { saveProfile } = useWorker();
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onContinue() {
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Worker sign-in</Text>
        <Text style={styles.subtitle}>
          Enter once per day. Your name is sent to the machine over Bluetooth when you start a
          session.
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
          onPress={onContinue}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, marginBottom: 16, color: "#64748b", lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#334155", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", marginBottom: 8 },
});
