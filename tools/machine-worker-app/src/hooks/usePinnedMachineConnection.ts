import { useCallback, useEffect, useRef, useState } from "react";
import type { Device } from "react-native-ble-plx";
import type { PinnedMachine } from "../config/storage";
import {
  HEARTBEAT_INTERVAL_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  STATUS_POLL_INTERVAL_MS,
} from "../config/constants";
import {
  connectPinnedMachine,
  disconnectBle,
  monitorBleStatus,
  readBleStatus,
  writeBleCommand,
  type BleMachineStatus,
} from "../ble/workerBle";

export type ConnectionPhase = "idle" | "connecting" | "connected" | "reconnecting" | "error";

type Options = {
  pinned: PinnedMachine | null;
  enabled: boolean;
  onDeviceId?: (deviceId: string) => void;
};

function reconnectDelayMs(attempt: number) {
  const exp = Math.min(attempt, 4);
  return Math.min(RECONNECT_BASE_MS * 2 ** exp, RECONNECT_MAX_MS);
}

export function usePinnedMachineConnection({ pinned, enabled, onDeviceId }: Options) {
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [status, setStatus] = useState<BleMachineStatus | null>(null);
  const [error, setError] = useState("");
  const deviceRef = useRef<Device | null>(null);
  const monitorRef = useRef<{ remove: () => void } | null>(null);
  const disconnectSubRef = useRef<{ remove: () => void } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pinnedRef = useRef(pinned);
  const onDeviceIdRef = useRef(onDeviceId);

  enabledRef.current = enabled;
  pinnedRef.current = pinned;
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
    monitorRef.current?.remove();
    monitorRef.current = null;
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    await disconnectBle(deviceRef.current);
    deviceRef.current = null;
  }, [clearReconnectTimer]);

  const scheduleReconnectRef = useRef<() => void>(() => {});

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

    try {
      await cleanupLink();
      const device = await connectPinnedMachine(pin);
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
        if (enabledRef.current && pinnedRef.current) {
          scheduleReconnectRef.current();
        } else {
          setPhase("idle");
        }
      });

      monitorRef.current = monitorBleStatus(device, setStatus);
      const initial = await readBleStatus(device);
      if (initial) setStatus(initial);
      reconnectAttemptRef.current = 0;
      setPhase("connected");
    } catch (err) {
      setPhase("reconnecting");
      setStatus(null);
      setError(err instanceof Error ? err.message : "Connection failed");
      scheduleReconnectRef.current();
    } finally {
      connectingRef.current = false;
    }
  }, [cleanupLink, clearReconnectTimer]);

  scheduleReconnectRef.current = () => {
    if (!enabledRef.current || !pinnedRef.current) return;
    if (reconnectTimerRef.current || connectingRef.current) return;
    setPhase("reconnecting");
    const delay = reconnectDelayMs(reconnectAttemptRef.current);
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectNow();
    }, delay);
  };

  useEffect(() => {
    if (!enabled || !pinned) {
      reconnectAttemptRef.current = 0;
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
        if (latest) setStatus(latest);
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

  const sendCommand = useCallback(
    async (command: Parameters<typeof writeBleCommand>[1]) => {
      const device = deviceRef.current;
      if (!device) throw new Error("Not connected to machine.");
      if (!(await device.isConnected())) {
        throw new Error("Not connected to machine.");
      }
      await writeBleCommand(device, command);
      const latest = await readBleStatus(device);
      if (latest) setStatus(latest);
      return latest;
    },
    []
  );

  return {
    phase,
    status,
    error,
    sendCommand,
    reconnect: connectNow,
  };
}
