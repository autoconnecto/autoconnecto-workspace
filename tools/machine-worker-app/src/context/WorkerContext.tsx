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
  editingProfile: boolean;
  saveProfile: (profile: WorkerProfile) => Promise<void>;
  pinMachine: (pin: PinnedMachine) => Promise<void>;
  changeMachine: () => Promise<void>;
  startProfileEdit: () => void;
  cancelProfileEdit: () => void;
  refresh: () => Promise<void>;
};

const WorkerContext = createContext<WorkerContextValue | null>(null);

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [pinned, setPinned] = useState<PinnedMachine | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

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
    setEditingProfile(false);
  }, []);

  const pinMachine = useCallback(async (pin: PinnedMachine) => {
    await savePinnedMachine(pin);
    setPinned(pin);
  }, []);

  const changeMachine = useCallback(async () => {
    await clearPinnedMachine();
    setPinned(null);
  }, []);

  const startProfileEdit = useCallback(() => {
    setEditingProfile(true);
  }, []);

  const cancelProfileEdit = useCallback(() => {
    setEditingProfile(false);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      profile,
      pinned,
      editingProfile,
      saveProfile,
      pinMachine,
      changeMachine,
      startProfileEdit,
      cancelProfileEdit,
      refresh,
    }),
    [
      loading,
      profile,
      pinned,
      editingProfile,
      saveProfile,
      pinMachine,
      changeMachine,
      startProfileEdit,
      cancelProfileEdit,
      refresh,
    ]
  );

  return <WorkerContext.Provider value={value}>{children}</WorkerContext.Provider>;
}

export function useWorker() {
  const ctx = useContext(WorkerContext);
  if (!ctx) throw new Error("useWorker outside WorkerProvider");
  return ctx;
}
