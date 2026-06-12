import { useCallback, useEffect, useRef, useState } from "react";
import type { Device } from "react-native-ble-plx";
import type { PinnedMachine } from "../config/storage";
import { HEARTBEAT_INTERVAL_MS, RECONNECT_INTERVAL_MS } from "../config/constants";
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

export function usePinnedMachineConnection({ pinned, enabled, onDeviceId }: Options) {
  const [phase, setPhase] = useState<ConnectionPhase>("idle");
  const [status, setStatus] = useState<BleMachineStatus | null>(null);
  const [error, setError] = useState("");
  const deviceRef = useRef<Device | null>(null);
  const monitorRef = useRef<{ remove: () => void } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pinnedRef = useRef(pinned);
  const onDeviceIdRef = useRef(onDeviceId);

  enabledRef.current = enabled;
  pinnedRef.current = pinned;
  onDeviceIdRef.current = onDeviceId;

  const cleanupLink = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    monitorRef.current?.remove();
    monitorRef.current = null;
    await disconnectBle(deviceRef.current);
    deviceRef.current = null;
  }, []);

  const scheduleReconnectRef = useRef<() => void>(() => {});

  const connectNow = useCallback(async () => {
    const pin = pinnedRef.current;
    if (!enabledRef.current || !pin || connectingRef.current) return;

    connectingRef.current = true;
    setError("");
    setPhase((p) => (p === "reconnecting" ? "reconnecting" : "connecting"));

    try {
      await cleanupLink();
      const device = await connectPinnedMachine(pin);
      deviceRef.current = device;
      onDeviceIdRef.current?.(device.id);

      device.onDisconnected(() => {
        deviceRef.current = null;
        monitorRef.current?.remove();
        monitorRef.current = null;
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
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
      setPhase("connected");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Connection failed");
      scheduleReconnectRef.current();
    } finally {
      connectingRef.current = false;
    }
  }, [cleanupLink]);

  scheduleReconnectRef.current = () => {
    if (!enabledRef.current || !pinnedRef.current) return;
    if (reconnectTimerRef.current) return;
    setPhase("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectNow();
    }, RECONNECT_INTERVAL_MS);
  };

  useEffect(() => {
    if (!enabled || !pinned) {
      void cleanupLink();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setPhase("idle");
      setStatus(null);
      return;
    }

    void connectNow();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      void cleanupLink();
    };
  }, [enabled, pinned?.bleAdvertName, pinned?.deviceId, connectNow, cleanupLink]);

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
        await writeBleCommand(device, { cmd: "heartbeat" });
      } catch {
        /* reconnect handles */
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
      await writeBleCommand(device, command);
      const latest = await readBleStatus(device);
      if (latest) setStatus(latest);
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
