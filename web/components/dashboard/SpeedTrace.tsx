"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { TelemetryFrame, Lap } from "@/lib/telemetry/types";

interface Props {
  frames: TelemetryFrame[];
  laps: Lap[];
}

const COLORS = ["#e10600", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];
const MAX_LAPS = 5;

export function SpeedTrace({ frames, laps }: Props) {
  const availableLaps = useMemo(
    () => [...new Set(frames.map((f) => f.lap))].sort((a, b) => a - b),
    [frames]
  );

  const [selectedLaps, setSelectedLaps] = useState<number[]>(
    availableLaps.slice(0, 2)
  );

  const toggleLap = (lap: number) => {
    setSelectedLaps((prev) =>
      prev.includes(lap) ? prev.filter((l) => l !== lap) : [...prev, lap].slice(-MAX_LAPS)
    );
  };

  const chartData = useMemo(() => {
    if (selectedLaps.length === 0) return [];
    // Build distance-keyed rows for overlay
    const byLap: Record<number, Record<string, number>> = {};
    for (const lap of selectedLaps) {
      const lapFrames = frames.filter((f) => f.lap === lap);
      for (const f of lapFrames) {
        const dist = Math.round(f.lap_distance_m / 5) * 5; // 5m buckets
        if (!byLap[dist]) byLap[dist] = { dist };
        byLap[dist][`L${lap}`] = f.speed_kmh;
      }
    }
    return Object.values(byLap).sort((a, b) => a.dist - b.dist);
  }, [frames, selectedLaps]);

  const lapInfo = useMemo(() => {
    const m: Record<number, Lap> = {};
    for (const l of laps) m[l.lap_number] = l;
    return m;
  }, [laps]);

  if (frames.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No telemetry frames.</p>;
  }

  return (
    <div>
      {/* Lap selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {availableLaps.map((lap, idx) => {
          const selected = selectedLaps.includes(lap);
          const color = COLORS[selectedLaps.indexOf(lap) % COLORS.length];
          const info = lapInfo[lap];
          return (
            <button
              key={lap}
              onClick={() => toggleLap(lap)}
              className="px-3 py-1 rounded text-xs font-mono transition-colors"
              style={{
                background: selected ? color : "var(--muted)",
                color: selected ? "#fff" : "var(--muted-foreground)",
                opacity: !selected && selectedLaps.length >= MAX_LAPS ? 0.5 : 1,
              }}
              title={info ? `Lap ${lap}` : undefined}
            >
              L{lap}
              {info?.valid === false && " ✗"}
            </button>
          );
        })}
        <span className="text-xs self-center" style={{ color: "var(--muted-foreground)" }}>
          (max {MAX_LAPS})
        </span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="dist"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}m`}
          />
          <YAxis
            domain={[0, 360]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: 12,
            }}
            formatter={(v, name) => [`${v} km/h`, name as string]}
            labelFormatter={(l) => `${l} m`}
            cursor={{ stroke: "var(--border)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
          />
          {selectedLaps.map((lap, idx) => (
            <Line
              key={lap}
              type="monotone"
              dataKey={`L${lap}`}
              stroke={COLORS[idx % COLORS.length]}
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
