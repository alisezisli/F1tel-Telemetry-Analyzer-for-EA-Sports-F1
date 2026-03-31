import type { Lap, TyreStint } from "../types";

export interface StintLap {
  lap_in_stint: number;
  lap_number: number;
  lap_time_ms: number;
  valid: boolean;
}

export interface StintData {
  stint_index: number;
  compound_visual: string;
  compound_actual: string;
  start_lap: number;
  end_lap: number;
  laps: StintLap[];
}

export function analyzeStintComparison(laps: Lap[], stints: TyreStint[]): StintData[] {
  return stints.map((stint, idx) => {
    const stintLaps = laps.filter(
      (l) => l.lap_number >= stint.start_lap && l.lap_number <= stint.end_lap
    );
    return {
      stint_index: idx,
      compound_visual: stint.compound_visual,
      compound_actual: stint.compound_actual,
      start_lap: stint.start_lap,
      end_lap: stint.end_lap,
      laps: stintLaps.map((l, i) => ({
        lap_in_stint: i + 1,
        lap_number: l.lap_number,
        lap_time_ms: l.lap_time_ms,
        valid: l.valid,
      })),
    };
  });
}
