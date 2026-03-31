"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { TelemetryFrame } from "@/lib/telemetry/types";

interface Props {
  frames: TelemetryFrame[];
}

const CORNERS = [
  { key: "tyre_wear_fl", label: "FL", color: "#3b82f6" },
  { key: "tyre_wear_fr", label: "FR", color: "#22c55e" },
  { key: "tyre_wear_rl", label: "RL", color: "#f59e0b" },
  { key: "tyre_wear_rr", label: "RR", color: "#a855f7" },
] as const;

export function TyreWear({ frames }: Props) {
  const data = useMemo(
    () =>
      frames.map((f, i) => ({
        i,
        lap: f.lap,
        tyre_wear_fl: f.tyre_wear_fl,
        tyre_wear_fr: f.tyre_wear_fr,
        tyre_wear_rl: f.tyre_wear_rl,
        tyre_wear_rr: f.tyre_wear_rr,
      })),
    [frames]
  );

  const hasData = frames.some(
    (f) => f.tyre_wear_fl > 0 || f.tyre_wear_fr > 0 || f.tyre_wear_rl > 0 || f.tyre_wear_rr > 0
  );

  if (!hasData) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        No tyre wear data. Wear data is only available in Race sessions.
      </p>
    );
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
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <XAxis dataKey="i" hide />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={36}
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
              return [`${v}%`, c?.label ?? (name as string)];
            }}
          />
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
