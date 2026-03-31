"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { StintData } from "@/lib/telemetry/analytics/index";
import { fmtLapTime } from "@/lib/utils";

interface Props {
  stints: StintData[];
}

const COLORS = ["#e10600", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];

const COMPOUND_COLOR: Record<string, string> = {
  Soft: "#e10600",
  Medium: "#f59e0b",
  Hard: "#e5e7eb",
  Intermediate: "#22c55e",
  Wet: "#3b82f6",
};

export function StintComparison({ stints }: Props) {
  const maxLen = Math.max(...stints.map((s) => s.laps.length));
  const chartData: Record<string, unknown>[] = Array.from({ length: maxLen }, (_, i) => ({
    lap_in_stint: i + 1,
  }));

  for (const stint of stints) {
    const key = `stint_${stint.stint_index}`;
    for (const lap of stint.laps) {
      const row = chartData[lap.lap_in_stint - 1];
      if (row) row[key] = lap.valid ? lap.lap_time_ms : null;
    }
  }

  const yMin =
    Math.min(
      ...stints.flatMap((s) =>
        s.laps.filter((l) => l.valid).map((l) => l.lap_time_ms)
      )
    ) * 0.995;
  const yMax =
    Math.max(
      ...stints.flatMap((s) =>
        s.laps.filter((l) => l.valid).map((l) => l.lap_time_ms)
      )
    ) * 1.005;

  return (
    <div>
      <div className="flex gap-4 mb-4 flex-wrap">
        {stints.map((s, idx) => {
          const cColor = COMPOUND_COLOR[s.compound_visual] ?? COLORS[idx % COLORS.length];
          return (
            <div key={s.stint_index} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: cColor }} />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Stint {s.stint_index + 1}: {s.compound_visual} (L{s.start_lap}–{s.end_lap === 255 ? "?" : s.end_lap})
              </span>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="lap_in_stint"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `Lap ${v}`}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => fmtLapTime(Math.round(v))}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: 12,
            }}
            formatter={(v, name) => {
              const nameStr = name as string;
              const idx = parseInt(nameStr.replace("stint_", ""));
              const stint = stints[idx];
              return [fmtLapTime(v as number), stint ? `Stint ${idx + 1} (${stint.compound_visual})` : nameStr];
            }}
            labelFormatter={(v) => `Lap ${v} in stint`}
            cursor={{ stroke: "var(--border)" }}
          />
          {stints.map((s, idx) => {
            const cColor = COMPOUND_COLOR[s.compound_visual] ?? COLORS[idx % COLORS.length];
            return (
              <Line
                key={s.stint_index}
                type="monotone"
                dataKey={`stint_${s.stint_index}`}
                stroke={cColor}
                dot={{ r: 2, fill: cColor }}
                strokeWidth={1.5}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
