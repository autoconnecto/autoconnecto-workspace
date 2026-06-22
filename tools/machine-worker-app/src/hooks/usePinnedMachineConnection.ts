import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Device } from "react-native-ble-plx";
import type { PinnedMachine, WorkerProfile } from "../config/storage";
import {
  ATTR_SYNC_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  RECONNECT_AFTER_DISCONNECT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RECONNECT_SESSION_BASE_MS,
  STATUS_POLL_INTERVAL_MS,
} from "../config/constants";
import {
  connectPinnedMachine,
  disconnectBle,
  isSessionOwnedByWorker,
  monitorBleStatus,
  readBleStatus,
  readBleStatusWithRetry,
  writeBleCommand,
  type BleMachineStatus,
} from "../ble/workerBle";
import {
  startShiftBackgroundService,
  stopShiftBackgroundService,
} from "../native/shiftBackgroundService";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "reconnecting" | "error";

type Options = {
  pinned: PinnedMachine | null;
  enabled: boolean;
  profile: WorkerProfile | null;
  onDeviceId?: (deviceId: string) => void;
};

function reconnectDelayMs(attempt: number, sessionWasActive: boolean) {
  const base = sessionWasActive ? RECONNECT_SESSION_BASE_MS : RECONNECT_BASE_MS;
  const exp = Math.min(attempt, 4);
  return Math.min(base * 2 ** exp, RECONNECT_MAX_MS);
}

async function hydrateStatusAfterConnect(
  device: Device,
  profile: WorkerProfile | null,
  prior: BleMachineStatus | null
): Promise<BleMachineStatus | null> {
  let latest = await readBleStatusWithRetry(device);
  if (!latest) return null;

  const shouldResume =
    profile &&
    prior?.session &&
    !latest.session &&
    isSessionOwnedByWorker(prior, profile.workerId);

  if (shouldResume) {
    try {
      await writeBleCommand(device, {
        cmd: "start",
        operator_id: profile.workerId,
        operator_name: profile.workerName,
      });
      latest = (await readBleStatusWithRetry(device, 3)) ?? latest;
    } catch {
      /* show START SESSION if resume fails */
    }
  }

  return latest;
}

export function usePinnedMachineConnection({ pinned, enabled, profile, onDeviceId }: Options) {
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [status, setStatus] = useState<BleMachineStatus | null>(null);
  const [error, setError] = useState("");
  const deviceRef = useRef<Device | null>(null);
  const monitorRef = useRef<{ remove: () => void } | null>(null);
  const disconnectSubRef = useRef<{ remove: () => void } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attrSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectingRef = useRef(false);
  const lastStatusRef = useRef<BleMachineStatus | null>(null);
  const enabledRef = useRef(enabled);
  const pinnedRef = useRef(pinned);
  const profileRef = useRef(profile);
  const onDeviceIdRef = useRef(onDeviceId);

  enabledRef.current = enabled;
  pinnedRef.current = pinned;
  profileRef.current = profile;
  onDeviceIdRef.current = onDeviceId;

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const cleanupLink = useCallback(async () => {
    clearReconnectTimer();
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
    if (attrSyncRef.current) {
      clearInterval(attrSyncRef.current);
      attrSyncRef.current = null;
    }
    monitorRef.current?.remove();
    monitorRef.current = null;
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    await disconnectBle(deviceRef.current);
    deviceRef.current = null;
    await stopShiftBackgroundService();
  }, [clearReconnectTimer]);

  const scheduleReconnectRef = useRef<(urgent?: boolean) => void>(() => {});

  const pullPlatformAttrs = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;
    try {
      if (!(await device.isConnected())) return;
      await writeBleCommand(device, { cmd: "sync_attrs" });
      const latest = await readBleStatusWithRetry(device, 6, 400);
      if (latest) {
        lastStatusRef.current = latest;
        setStatus(latest);
      }
    } catch {
      /* MQTT pull is best-effort */
    }
  }, []);

  const connectNow = useCallback(async () => {
    const pin = pinnedRef.current;
    if (!enabledRef.current || !pin || connectingRef.current) return;

    if (deviceRef.current) {
      try {
        if (await deviceRef.current.isConnected()) {
          setPhase("connected");
          clearReconnectTimer();
          reconnectAttemptRef.current = 0;
          return;
        }
      } catch {
        /* fall through to full reconnect */
      }
    }

    connectingRef.current = true;
    clearReconnectTimer();
    setError("");
    setPhase((p) => (p === "reconnecting" ? "reconnecting" : "connecting"));

    const priorStatus = lastStatusRef.current;

    let scheduleAfterFail = false;

    try {
      await cleanupLink();
      const attempt = reconnectAttemptRef.current;
      const device = await connectPinnedMachine(pin, {
        resetBle: attempt >= 1,
        skipCachedDeviceId: attempt >= 1,
      });
      deviceRef.current = device;
      onDeviceIdRef.current?.(device.id);

      disconnectSubRef.current = device.onDisconnected(() => {
        deviceRef.current = null;
        monitorRef.current?.remove();
        monitorRef.current = null;
        disconnectSubRef.current?.remove();
        disconnectSubRef.current = null;
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (statusPollRef.current) {
          clearInterval(statusPollRef.current);
          statusPollRef.current = null;
        }
        if (attrSyncRef.current) {
          clearInterval(attrSyncRef.current);
          attrSyncRef.current = null;
        }
        if (enabledRef.current && pinnedRef.current) {
          reconnectAttemptRef.current = 0;
          setTimeout(() => {
            if (!enabledRef.current || !pinnedRef.current || deviceRef.current) return;
            scheduleReconnectRef.current(true);
          }, RECONNECT_AFTER_DISCONNECT_MS);
        } else {
          setPhase("idle");
        }
      });

      monitorRef.current = monitorBleStatus(device, (next) => {
        lastStatusRef.current = next;
        setStatus(next);
      });

      const initial = await hydrateStatusAfterConnect(
        device,
        profileRef.current,
        priorStatus
      );
      if (initial) {
        lastStatusRef.current = initial;
        setStatus(initial);
      }

      try {
        await pullPlatformAttrs();
      } catch {
        /* MQTT sync is best-effort; periodic sync also runs while connected */
      }

      reconnectAttemptRef.current = 0;
      setPhase("connected");
    } catch (err) {
      setPhase("reconnecting");
      setError(err instanceof Error ? err.message : "Connection failed");
      scheduleAfterFail = true;
    } finally {
      connectingRef.current = false;
      if (scheduleAfterFail) {
        scheduleReconnectRef.current();
      }
    }
  }, [cleanupLink, clearReconnectTimer, pullPlatformAttrs]);

  scheduleReconnectRef.current = (urgent = false) => {
    if (!enabledRef.current || !pinnedRef.current) return;
    if (reconnectTimerRef.current && !urgent) return;

    if (urgent && reconnectTimerRef.current) {
      clearReconnectTimer();
    }

    setPhase("reconnecting");
    const sessionWasActive = Boolean(lastStatusRef.current?.session);
    const attempt = urgent ? 0 : reconnectAttemptRef.current;
    const delay = urgent ? RECONNECT_SESSION_BASE_MS : reconnectDelayMs(attempt, sessionWasActive);
    if (!urgent) reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectNowRef.current();
    }, delay);
  };

  const connectNowRef = useRef(connectNow);
  connectNowRef.current = connectNow;

  const verifyLink = useCallback(async () => {
    if (!enabledRef.current || !pinnedRef.current) return;
    const device = deviceRef.current;
    if (!device) {
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      void connectNowRef.current();
      return;
    }
    try {
      if (!(await device.isConnected())) {
        scheduleReconnectRef.current(true);
        return;
      }
      await pullPlatformAttrs();
    } catch {
      scheduleReconnectRef.current(true);
    }
  }, [clearReconnectTimer, pullPlatformAttrs]);

  const verifyLinkRef = useRef(verifyLink);
  verifyLinkRef.current = verifyLink;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      if (!enabledRef.current || !pinnedRef.current) return;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      void verifyLinkRef.current();
    });
    return () => sub.remove();
  }, [clearReconnectTimer]);

  /** Safety net: keep trying while shift screen is open and link is down. */
  useEffect(() => {
    if (!enabled || !pinned) return;

    const id = setInterval(() => {
      if (!enabledRef.current || !pinnedRef.current) return;
      if (connectingRef.current) return;
      if (deviceRef.current) return;
      if (reconnectTimerRef.current) return;
      scheduleReconnectRef.current(true);
    }, 5000);

    return () => clearInterval(id);
  }, [enabled, pinned?.bleAdvertName]);

  useEffect(() => {
    if (!enabled || !pinned) {
      reconnectAttemptRef.current = 0;
      lastStatusRef.current = null;
      void cleanupLink();
      setPhase("idle");
      setStatus(null);
      return;
    }

    void connectNow();

    return () => {
      reconnectAttemptRef.current = 0;
      void cleanupLink();
    };
  }, [enabled, pinned?.bleAdvertName, connectNow, cleanupLink]);

  useEffect(() => {
    if (phase !== "connected" || !deviceRef.current) {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      return;
    }
    if (statusPollRef.current) return;

    statusPollRef.current = setInterval(async () => {
      const device = deviceRef.current;
      if (!device) return;
      try {
        if (!(await device.isConnected())) return;
        const latest = await readBleStatus(device);
        if (latest) {
          lastStatusRef.current = latest;
          setStatus(latest);
        }
      } catch {
        /* onDisconnected handles link loss */
      }
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "connected" || !deviceRef.current) {
      if (attrSyncRef.current) {
        clearInterval(attrSyncRef.current);
        attrSyncRef.current = null;
      }
      return;
    }
    if (attrSyncRef.current) return;

    attrSyncRef.current = setInterval(() => {
      void pullPlatformAttrs();
    }, ATTR_SYNC_INTERVAL_MS);

    return () => {
      if (attrSyncRef.current) {
        clearInterval(attrSyncRef.current);
        attrSyncRef.current = null;
      }
    };
  }, [phase, pullPlatformAttrs]);

  useEffect(() => {
    if (!status?.session || phase !== "connected" || !deviceRef.current) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }
    if (heartbeatRef.current) return;

    heartbeatRef.current = setInterval(async () => {
      const device = deviceRef.current;
      if (!device) return;
      try {
        if (!(await device.isConnected())) return;
        await writeBleCommand(device, { cmd: "heartbeat" });
      } catch {
        /* onDisconnected handles link loss */
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [status?.session, phase]);

  useEffect(() => {
    const machine = pinned?.bleAdvertName?.trim();
    if (phase === "connected" && machine) {
      void startShiftBackgroundService(`Connected to ${machine}`);
      return () => {
        void stopShiftBackgroundService();
      };
    }
    void stopShiftBackgroundService();
    return undefined;
  }, [phase, pinned?.bleAdvertName]);

  const sendCommand = useCallback(
    async (command: Parameters<typeof writeBleCommand>[1]) => {
      const device = deviceRef.current;
      if (!device) throw new Error("Not connected to machine.");
      if (!(await device.isConnected())) {
        throw new Error("Not connected to machine.");
      }
      await writeBleCommand(device, command);
      const latest = await readBleStatus(device);
      if (latest) {
        lastStatusRef.current = latest;
        setStatus(latest);
      }
      return latest;
    },
    []
  );

  const sessionSuspended =
    phase !== "connected" &&
    Boolean(lastStatusRef.current?.session && profile?.workerId);

  return {
    phase,
    status,
    error,
    sessionSuspended,
    sendCommand,
    reconnect: connectNow,
  };
}
