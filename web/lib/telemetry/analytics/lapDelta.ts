import type { Lap } from "../types";

export interface LapDeltaRow extends Lap {
  delta_ms: number | null; // vs personal best
  is_best: boolean;
}

export function analyzeLapDelta(laps: Lap[]): LapDeltaRow[] {
  const valid = laps.filter((l) => l.valid && l.lap_time_ms > 0);
  const bestTime = valid.length > 0 ? Math.min(...valid.map((l) => l.lap_time_ms)) : null;

  return laps.map((lap) => ({
    ...lap,
    delta_ms: bestTime !== null && lap.valid && lap.lap_time_ms > 0
      ? lap.lap_time_ms - bestTime
      : null,
    is_best: bestTime !== null && lap.lap_time_ms === bestTime && lap.valid,
  }));
}
