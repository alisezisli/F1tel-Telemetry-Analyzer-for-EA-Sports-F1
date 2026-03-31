/**
 * Web Worker - parses a .f1tel ArrayBuffer and runs analytics.
 * Communicates via postMessage:
 *   IN:  { type: "parse", buffer: ArrayBuffer }
 *   OUT: { type: "progress", pct: number, message: string }
 *       { type: "done", data: F1TelData, analytics: AnalyticsResult }
 *       { type: "error", message: string }
 */

import { parseF1Tel, ParseError } from "./parser";
import { runAnalytics } from "./analytics/index";

self.onmessage = async (e: MessageEvent) => {
  if (e.data?.type !== "parse") return;

  const buffer: ArrayBuffer = e.data.buffer;

  try {
    self.postMessage({ type: "progress", pct: 10, message: "Reading file..." });

    const data = await parseF1Tel(buffer);

    self.postMessage({ type: "progress", pct: 70, message: "Running analytics..." });

    const analytics = runAnalytics(data);

    self.postMessage({ type: "progress", pct: 100, message: "Done" });
    self.postMessage({ type: "done", data, analytics });
  } catch (err) {
    const message = err instanceof ParseError
      ? err.message
      : "Unexpected error while processing file";
    self.postMessage({ type: "error", message });
  }
};
