"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";
import type { TelemetryFrame } from "@/lib/telemetry/types";

interface Props {
  frames: TelemetryFrame[];
}

const CORNERS = [
  { key: "tyre_surf_fl", label: "FL", color: "#3b82f6" },
  { key: "tyre_surf_fr", label: "FR", color: "#22c55e" },
  { key: "tyre_surf_rl", label: "RL", color: "#f59e0b" },
  { key: "tyre_surf_rr", label: "RR", color: "#a855f7" },
] as const;

// Ideal tyre surface temp range (approximate, compound-agnostic)
const IDEAL_MIN = 80;
const IDEAL_MAX = 110;

export function TyreTemperature({ frames }: Props) {
  const data = useMemo(
    () =>
      frames.map((f, i) => ({
        i,
        lap: f.lap,
        tyre_surf_fl: f.tyre_surf_fl,
        tyre_surf_fr: f.tyre_surf_fr,
        tyre_surf_rl: f.tyre_surf_rl,
        tyre_surf_rr: f.tyre_surf_rr,
      })),
    [frames]
  );

  if (data.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No telemetry frames.</p>;
  }

  return (
    <div>
      <div className="flex gap-4 mb-3 flex-wrap">
        {CORNERS.map((c) => (
          <div key={c.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{c.label}</span>
          </div>
        ))}
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          · Ideal range: {IDEAL_MIN}–{IDEAL_MAX}°C (highlighted)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <XAxis dataKey="i" hide />
          <YAxis
            domain={[40, 130]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}°`}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: 12,
            }}
            labelFormatter={() => ""}
            formatter={(v, name) => {
              const c = CORNERS.find((c) => c.key === (name as string));
              return [`${v}°C`, c?.label ?? (name as string)];
            }}
          />
          <ReferenceArea y1={IDEAL_MIN} y2={IDEAL_MAX} fill="#22c55e" fillOpacity={0.06} />
          {CORNERS.map((c) => (
            <Line
              key={c.key}
              type="monotone"
              dataKey={c.key}
              stroke={c.color}
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
