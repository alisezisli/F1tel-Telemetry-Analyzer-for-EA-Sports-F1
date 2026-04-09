"use client";

import { useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { ECharts } from "echarts";
import type { TelemetryFrame } from "@/lib/telemetry/types";
import { useT } from "@/lib/i18n";

interface Props {
  frames: TelemetryFrame[];
  groupId?: string;
}

const CORNERS = [
  { key: "tyre_surf_fl" as const, label: "FL", color: "#3b82f6" },
  { key: "tyre_surf_fr" as const, label: "FR", color: "#22c55e" },
  { key: "tyre_surf_rl" as const, label: "RL", color: "#f59e0b" },
  { key: "tyre_surf_rr" as const, label: "RR", color: "#a855f7" },
];

const IDEAL_MIN = 80;
const IDEAL_MAX = 110;

export function TyreTemperature({ frames, groupId }: Props) {
  const t = useT();

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { top: 8, right: 16, bottom: 8, left: 44, containLabel: false },
    xAxis: {
      type: "value" as const,
      show: false,
      min: 0,
      max: frames.length - 1,
    },
    yAxis: {
      type: "value" as const,
      min: 40,
      max: 130,
      axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: "{value}°" },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    series: CORNERS.map((c, idx) => ({
      name: c.label,
      type: "line" as const,
      data: frames.map((f, i) => [i, f[c.key]]),
      lineStyle: { color: c.color, width: 1.5 },
      itemStyle: { color: c.color },
      symbol: "none",
      animation: false,
      ...(idx === 0 ? {
        markArea: {
          silent: true,
          itemStyle: { color: "rgba(34,197,94,0.08)" },
          data: [[{ yAxis: IDEAL_MIN }, { yAxis: IDEAL_MAX }]],
        },
      } : {}),
    })),
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#141414",
      borderColor: "#262626",
      textStyle: { color: "#f5f5f5", fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as Array<{ seriesName: string; value: [number, number] }>;
        const lap = frames[p[0]?.value[0]]?.lap ?? "";
        const lines = p.map((item) => `${item.seriesName}: ${item.value[1].toFixed(1)}°C`);
        return `Lap ${lap}<br/>${lines.join("<br/>")}`;
      },
    },
    dataZoom: [{ type: "inside" as const, filterMode: "none" as const, zoomOnMouseWheel: "ctrl" as const }],
  }), [frames]);

  const onChartReady = useCallback((instance: ECharts) => {
    if (groupId) {
      (instance as ECharts & { group: string }).group = groupId;
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
      <div className="flex gap-4 mb-3 flex-wrap">
        {CORNERS.map((c) => (
          <div key={c.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{c.label}</span>
          </div>
        ))}
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          · {t("idealRange")}: {IDEAL_MIN}–{IDEAL_MAX}°C ({t("highlighted")})
        </span>
      </div>
      <ReactECharts option={option} onChartReady={onChartReady} style={{ width: "100%", height: 320 }} />
    </div>
  );
}
