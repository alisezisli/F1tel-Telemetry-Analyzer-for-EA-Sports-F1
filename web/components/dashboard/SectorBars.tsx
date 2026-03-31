"use client";

import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Lap } from "@/lib/telemetry/types";
import { fmtSectorTime } from "@/lib/utils";

interface Props {
  laps: Lap[];
}

const SECTOR_COLORS = ["#3b82f6", "#f97316", "#22c55e"]; // S1 blue, S2 orange, S3 green
const BEST_COLOR = "#a855f7"; // purple — classic F1 best sector color

export function SectorBars({ laps }: Props) {
  const valid = laps.filter((l) => l.valid && l.sector1_ms > 0);
  if (valid.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No valid lap data.</p>;
  }

  const bestS1 = Math.min(...valid.map((l) => l.sector1_ms));
  const bestS2 = Math.min(...valid.map((l) => l.sector2_ms));
  const bestS3 = Math.min(...valid.map((l) => l.sector3_ms));
  const bests = [bestS1, bestS2, bestS3];

  const data = valid.map((lap) => ({
    name: `L${lap.lap_number}`,
    s1: lap.sector1_ms,
    s2: lap.sector2_ms,
    s3: lap.sector3_ms,
  }));

  const sectorValues = [
    valid.map((l) => l.sector1_ms),
    valid.map((l) => l.sector2_ms),
    valid.map((l) => l.sector3_ms),
  ];

  const tickFormatter = (v: number) => fmtSectorTime(Math.round(v));

  const tooltipFormatter = (value: unknown, name: unknown) => [
    fmtSectorTime(value as number),
    (name as string).toUpperCase(),
  ];

  return (
    <div className="flex flex-col gap-6">
      {(["s1", "s2", "s3"] as const).map((sector, idx) => {
        const best = bests[idx];
        const vals = sectorValues[idx];
        const yMin = Math.min(...vals) * 0.97;
        const yMax = Math.max(...vals) * 1.01;
        const baseColor = SECTOR_COLORS[idx];

        return (
          <div key={sector}>
            <p className="text-xs mb-2 font-medium" style={{ color: "var(--muted-foreground)" }}>
              SECTOR {idx + 1} · Best: {fmtSectorTime(best)}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} barSize={18}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tickFormatter={tickFormatter}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "var(--foreground)" }}
                  labelStyle={{ color: "var(--foreground)" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <ReferenceLine y={best} stroke={BEST_COLOR} strokeDasharray="4 2" strokeWidth={1} />
                <Bar dataKey={sector} radius={[3, 3, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry[sector] === best ? BEST_COLOR : baseColor}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
