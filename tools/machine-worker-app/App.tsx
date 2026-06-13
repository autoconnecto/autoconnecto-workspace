import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WorkerProvider, useWorker } from "./src/context/WorkerContext";
import { PickMachineScreen } from "./src/screens/PickMachineScreen";
import { ShiftScreen } from "./src/screens/ShiftScreen";
import { WorkerSetupScreen } from "./src/screens/WorkerSetupScreen";
import { colors } from "./src/config/theme";

function RootView() {
  const { loading, profile, pinned, editingProfile } = useWorker();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!profile || editingProfile) {
    return <WorkerSetupScreen initialProfile={editingProfile ? profile : null} />;
  }
  if (!pinned) return <PickMachineScreen />;
  return <ShiftScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WorkerProvider>
        <StatusBar style="light" />
        <RootView />
      </WorkerProvider>
    </SafeAreaProvider>
  );
}
