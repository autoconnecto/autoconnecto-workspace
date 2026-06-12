import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearPinnedMachine,
  clearWorkerProfile,
  loadPinnedMachine,
  loadWorkerProfile,
  savePinnedMachine,
  saveWorkerProfile,
  type PinnedMachine,
  type WorkerProfile,
} from "../config/storage";

type WorkerContextValue = {
  loading: boolean;
  profile: WorkerProfile | null;
  pinned: PinnedMachine | null;
  saveProfile: (profile: WorkerProfile) => Promise<void>;
  pinMachine: (pin: PinnedMachine) => Promise<void>;
  clearPin: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkerContext = createContext<WorkerContextValue | null>(null);

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [pinned, setPinned] = useState<PinnedMachine | null>(null);

  const refresh = useCallback(async () => {
    const [p, pin] = await Promise.all([loadWorkerProfile(), loadPinnedMachine()]);
    setProfile(p);
    setPinned(pin);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const saveProfile = useCallback(async (next: WorkerProfile) => {
    await saveWorkerProfile(next);
    setProfile(next);
  }, []);

  const pinMachine = useCallback(async (pin: PinnedMachine) => {
    await savePinnedMachine(pin);
    setPinned(pin);
  }, []);

  const clearPin = useCallback(async () => {
    await clearPinnedMachine();
    setPinned(null);
  }, []);

  const logout = useCallback(async () => {
    await clearPinnedMachine();
    await clearWorkerProfile();
    setPinned(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      profile,
      pinned,
      saveProfile,
      pinMachine,
      clearPin,
      logout,
      refresh,
    }),
    [loading, profile, pinned, saveProfile, pinMachine, clearPin, logout, refresh]
  );

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}

export function useWorker() {
  const ctx = useContext(WorkerContext);
  if (!ctx) throw new Error("useWorker outside WorkerProvider");
  return ctx;
}
