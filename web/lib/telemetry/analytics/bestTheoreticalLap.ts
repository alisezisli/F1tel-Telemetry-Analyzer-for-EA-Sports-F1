import type { Lap } from "../types";

export interface BestTheoreticalLap {
  sector1_ms: number;
  sector2_ms: number;
  sector3_ms: number;
  total_ms: number;
  gap_to_best_ms: number; // how much faster than actual best lap
}

export function analyzeBestTheoreticalLap(laps: Lap[]): BestTheoreticalLap | null {
  const valid = laps.filter((l) => l.valid && l.sector1_ms > 0 && l.sector2_ms > 0 && l.sector3_ms > 0);
  if (valid.length === 0) return null;

  const bestS1 = Math.min(...valid.map((l) => l.sector1_ms));
  const bestS2 = Math.min(...valid.map((l) => l.sector2_ms));
  const bestS3 = Math.min(...valid.map((l) => l.sector3_ms));
  const total = bestS1 + bestS2 + bestS3;

  const bestActual = Math.min(...valid.map((l) => l.lap_time_ms));

  return {
    sector1_ms: bestS1,
    sector2_ms: bestS2,
    sector3_ms: bestS3,
    total_ms: total,
    gap_to_best_ms: bestActual - total,
  };
}
