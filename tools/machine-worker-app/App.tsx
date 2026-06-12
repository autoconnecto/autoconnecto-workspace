import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WorkerProvider, useWorker } from "./src/context/WorkerContext";
import { PickMachineScreen } from "./src/screens/PickMachineScreen";
import { ShiftScreen } from "./src/screens/ShiftScreen";
import { WorkerSetupScreen } from "./src/screens/WorkerSetupScreen";

function RootView() {
  const { loading, profile, pinned } = useWorker();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) return <WorkerSetupScreen />;
  if (!pinned) return <PickMachineScreen />;
  return <ShiftScreen />;
}

export default function App() {
  return (
    <WorkerProvider>
      <StatusBar style="light" />
      <RootView />
    </WorkerProvider>
  );
}
