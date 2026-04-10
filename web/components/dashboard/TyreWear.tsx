"use client";

import { useMemo, useCallback } from "react";
import EChartsReactCore from "echarts-for-react/lib/core";
import { echarts } from "@/lib/echarts";
import type { TelemetryFrame } from "@/lib/telemetry/types";
import { useT } from "@/lib/i18n";

interface Props {
  frames: TelemetryFrame[];
  groupId?: string;
}

const CORNERS = [
  { key: "tyre_wear_fl" as const, label: "FL", color: "#3b82f6" },
  { key: "tyre_wear_fr" as const, label: "FR", color: "#22c55e" },
  { key: "tyre_wear_rl" as const, label: "RL", color: "#f59e0b" },
  { key: "tyre_wear_rr" as const, label: "RR", color: "#a855f7" },
];

export function TyreWear({ frames, groupId }: Props) {
  const t = useT();

  const hasData = frames.some(
    (f) => f.tyre_wear_fl > 0 || f.tyre_wear_fr > 0 || f.tyre_wear_rl > 0 || f.tyre_wear_rr > 0
  );

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { top: 8, right: 16, bottom: 8, left: 48, containLabel: false },
    xAxis: {
      type: "value" as const,
      show: false,
      min: 0,
      max: frames.length - 1,
    },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: "{value}%" },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    series: CORNERS.map((c) => ({
      name: c.label,
      type: "line" as const,
      data: frames.map((f, i) => [i, f[c.key]]),
      lineStyle: { color: c.color, width: 1.5 },
      itemStyle: { color: c.color },
      symbol: "none",
      animation: false,
    })),
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#141414",
      borderColor: "#262626",
      textStyle: { color: "#f5f5f5", fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as Array<{ seriesName: string; value: [number, number] }>;
        const lap = frames[p[0]?.value[0]]?.lap ?? "";
        const lines = p.map((item) => `${item.seriesName}: ${item.value[1].toFixed(1)}%`);
        return `Lap ${lap}<br/>${lines.join("<br/>")}`;
      },
    },
    dataZoom: [{ type: "inside" as const, filterMode: "none" as const, zoomOnMouseWheel: "ctrl" as const }],
  }), [frames]);

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

  if (!hasData) {
    return (
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        {t("noTyreWearData")}
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
      <EChartsReactCore echarts={echarts} option={option} onChartReady={onChartReady} style={{ width: "100%", height: 320 }} />
    </div>
  );
}
