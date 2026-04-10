"use client";

import { useMemo, useCallback, useRef } from "react";
import EChartsReactCore from "echarts-for-react/lib/core";
import { echarts } from "@/lib/echarts";
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

const DownloadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export function TyreTemperature({ frames, groupId }: Props) {
  const t = useT();
  const echartsRef = useRef<EChartsReactCore>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownload = useCallback(() => {
    const url = (echartsRef.current as any)?.getEchartsInstance().getDataURL({ type: "png", backgroundColor: "#0a0a0a", pixelRatio: 2 });
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = "tyre-temperature.png"; a.click();
  }, []);

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
        <button
          onClick={handleDownload}
          className="ml-auto p-1 rounded opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
          title={t("downloadPng")}
        ><DownloadIcon /></button>
      </div>
      <EChartsReactCore ref={echartsRef} echarts={echarts} option={option} onChartReady={onChartReady} style={{ width: "100%", height: 320 }} />
    </div>
  );
}
