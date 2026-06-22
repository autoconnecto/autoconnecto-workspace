import type { BleMachineStatus } from "../ble/workerBle";

export type ToolLifeDisplay = {
  enabled: boolean;
  remaining: number | null;
  label: string;
  tone: "ok" | "warn" | "bad" | "neutral";
};

/**
 * Tool life on the worker phone comes from the ESP over BLE only.
 * Tenant-scoped config is saved in the dashboard (logged-in user) → MQTT SHARED → ESP.
 */
export function resolveToolLifeDisplay(status: BleMachineStatus | null): ToolLifeDisplay {
  const enabled = status?.tool_life_enabled === true;
  const remaining =
    status?.tool_remaining !== undefined && status.tool_remaining >= 0
      ? Math.floor(status.tool_remaining)
      : null;

  if (!enabled) {
    return { enabled: false, remaining: null, label: "Off", tone: "neutral" };
  }

  if (remaining === null) {
    return { enabled: true, remaining: null, label: "…", tone: "neutral" };
  }

  if (remaining <= 0 || status?.allow_run === false) {
    return { enabled: true, remaining: 0, label: "0", tone: "bad" };
  }

  if (remaining <= 3) {
    return { enabled: true, remaining, label: String(remaining), tone: "warn" };
  }

  return { enabled: true, remaining, label: String(remaining), tone: "ok" };
}
