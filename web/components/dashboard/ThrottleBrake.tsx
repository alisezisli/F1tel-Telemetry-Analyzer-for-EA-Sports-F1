"use client";

import { useMemo, useCallback } from "react";
import EChartsReactCore from "echarts-for-react/lib/core";
import { echarts } from "@/lib/echarts";
import type { TelemetryFrame, Lap } from "@/lib/telemetry/types";

interface Props {
  frames: TelemetryFrame[];
  laps: Lap[];
  groupId?: string;
  selectedLaps: number[];
  availableLaps: number[];
  onToggleLap: (lap: number) => void;
}

const COLORS = ["#e10600", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];
const MAX_LAPS = 5;

export function ThrottleBrake({ frames, laps, groupId, selectedLaps, availableLaps, onToggleLap }: Props) {
  const lapInfo = useMemo(() => {
    const m: Record<number, Lap> = {};
    for (const l of laps) m[l.lap_number] = l;
    return m;
  }, [laps]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { top: 8, right: 16, bottom: 28, left: 44, containLabel: false },
    xAxis: {
      type: "value" as const,
      axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: (v: number) => `${v}m` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: (v: number) => `${v}%` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    series: selectedLaps.flatMap((lap, idx) => {
      const color = COLORS[idx % COLORS.length];
      const lapFrames = frames.filter((f) => f.lap === lap);
      const byDist: Record<number, TelemetryFrame> = {};
      for (const f of lapFrames) {
        const dist = Math.round(f.lap_distance_m / 5) * 5;
        byDist[dist] = f;
      }
      const points = Object.entries(byDist).sort(([a], [b]) => Number(a) - Number(b));

      return [
        {
          name: `L${lap} Throttle`,
          type: "line" as const,
          data: points.map(([dist, f]) => [Number(dist), Math.round(f.throttle * 100)]),
          lineStyle: { color, width: 2, type: "solid" as const },
          itemStyle: { color },
          symbol: "none",
          animation: false,
        },
        {
          name: `L${lap} Brake`,
          type: "line" as const,
          data: points.map(([dist, f]) => [Number(dist), Math.round(f.brake * 100)]),
          lineStyle: { color, width: 2, type: "dashed" as const },
          itemStyle: { color },
          symbol: "none",
          animation: false,
        },
      ];
    }),
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#141414",
      borderColor: "#262626",
      textStyle: { color: "#f5f5f5", fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as Array<{ seriesName: string; value: [number, number] }>;
        const dist = p[0]?.value[0] ?? "";
        const lines = p.map((item) => `${item.seriesName}: ${item.value[1]}%`);
        return `${dist}m<br/>${lines.join("<br/>")}`;
      },
    },
    dataZoom: [{ type: "inside" as const, filterMode: "none" as const, zoomOnMouseWheel: "ctrl" as const }],
  }), [frames, selectedLaps]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onChartReady = useCallback((instance: any) => {
    if (groupId) {
      instance.group = groupId;
      echarts.connect(groupId);
    }
    const dom = instance.getDom();
    const onWheel = (e: WheelEvent) => { if (!e.ctrlKey) e.stopImmediatePropagation(); };
    dom.addEventListener("wheel", onWheel, { capture: true, passive: true });
  }, [groupId]);

  if (frames.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No telemetry frames.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {availableLaps.map((lap) => {
          const selected = selectedLaps.includes(lap);
          const color = COLORS[selectedLaps.indexOf(lap) % COLORS.length];
          const info = lapInfo[lap];
          return (
            <button
              key={lap}
              onClick={() => onToggleLap(lap)}
              className="px-3 py-1 rounded text-xs font-mono transition-colors"
              style={{
                background: selected ? color : "var(--muted)",
                color: selected ? "#fff" : "var(--muted-foreground)",
                opacity: !selected && selectedLaps.length >= MAX_LAPS ? 0.5 : 1,
              }}
            >
              L{lap}
              {info?.valid === false && " \u2717"}
            </button>
          );
        })}
        <span className="text-xs self-center" style={{ color: "var(--muted-foreground)" }}>
          (max {MAX_LAPS})
        </span>
      </div>
      <EChartsReactCore
        echarts={echarts}
        option={option}
        notMerge={true}
        onChartReady={onChartReady}
        style={{ width: "100%", height: 320 }}
      />
    </div>
  );
}
