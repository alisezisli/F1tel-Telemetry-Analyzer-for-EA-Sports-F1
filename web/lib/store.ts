import type { F1TelData } from "./telemetry/types";
import type { AnalyticsResult } from "./telemetry/analytics/index";

export interface SessionPayload {
  data: F1TelData;
  analytics: AnalyticsResult;
}

// In-memory store — no size limit, cleared when tab closes (intentional)
const store = new Map<string, SessionPayload>();

export function storeSession(id: string, payload: SessionPayload): void {
  store.set(id, payload);
}

export function getSession(id: string): SessionPayload | undefined {
  return store.get(id);
}
