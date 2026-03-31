import type { F1TelData } from "../types";
import { analyzeLapDelta } from "./lapDelta";
import { analyzeBestTheoreticalLap } from "./bestTheoreticalLap";
import { analyzeStintComparison } from "./stintComparison";

export type { LapDeltaRow } from "./lapDelta";
export type { BestTheoreticalLap } from "./bestTheoreticalLap";
export type { StintData } from "./stintComparison";

export interface AnalyticsResult {
  lapDelta: ReturnType<typeof analyzeLapDelta>;
  bestTheoreticalLap: ReturnType<typeof analyzeBestTheoreticalLap>;
  stintComparison: ReturnType<typeof analyzeStintComparison>;
}

export function runAnalytics(data: F1TelData): AnalyticsResult {
  return {
    lapDelta: analyzeLapDelta(data.laps),
    bestTheoreticalLap: analyzeBestTheoreticalLap(data.laps),
    stintComparison: analyzeStintComparison(data.laps, data.tyre_stints),
  };
}
