"use client";

import { useMemo, useCallback, useRef } from "react";
import EChartsReactCore from "echarts-for-react/lib/core";
import { echarts } from "@/lib/echarts";
import type { TelemetryFrame, Lap } from "@/lib/telemetry/types";
import { useT } from "@/lib/i18n";

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

const DownloadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export function GearRpm({ frames, laps, groupId, selectedLaps, availableLaps, onToggleLap }: Props) {
  const t = useT();
  const echartsRef = useRef<EChartsReactCore>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownload = useCallback(() => {
    const url = (echartsRef.current as any)?.getEchartsInstance().getDataURL({ type: "png", backgroundColor: "#0a0a0a", pixelRatio: 2 });
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = "gear-rpm.png"; a.click();
  }, []);
  const lapInfo = useMemo(() => {
    const m: Record<number, Lap> = {};
    for (const l of laps) m[l.lap_number] = l;
    return m;
  }, [laps]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { top: 8, right: 52, bottom: 28, left: 60, containLabel: false },
    xAxis: {
      type: "value" as const,
      axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: (v: number) => `${v}m` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    yAxis: [
      {
        type: "value" as const,
        name: "RPM",
        nameTextStyle: { color: "#a1a1aa", fontSize: 10 },
        min: 0,
        max: 16000,
        interval: 4000,
        axisLabel: { fontSize: 10, color: "#a1a1aa", formatter: (v: number) => `${v / 1000}k` },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#262626" } },
      },
      {
        type: "value" as const,
        name: "Gear",
        nameTextStyle: { color: "#a1a1aa", fontSize: 10 },
        min: 0,
        max: 8,
        interval: 1,
        axisLabel: { fontSize: 10, color: "#a1a1aa" },
        axisLine: { show: false },
        splitLine: { show: false },
      },
    ],
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
          name: `L${lap} RPM`,
          type: "line" as const,
          yAxisIndex: 0,
          data: points.map(([dist, f]) => [Number(dist), f.rpm]),
          lineStyle: { color, width: 1.5, type: "solid" as const },
          itemStyle: { color },
          symbol: "none",
          animation: false,
        },
        {
          name: `L${lap} Gear`,
          type: "line" as const,
          yAxisIndex: 1,
          step: "end" as const,
          data: points.map(([dist, f]) => [Number(dist), f.gear]),
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
        const lines = p.map((item) => {
          const isGear = item.seriesName.includes("Gear");
          return `${item.seriesName}: ${isGear ? item.value[1] : item.value[1].toFixed(0)}${isGear ? "" : " rpm"}`;
        });
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
        <button
          onClick={handleDownload}
          className="ml-auto p-1 rounded opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
          title={t("downloadPng")}
        ><DownloadIcon /></button>
      </div>
      <EChartsReactCore
        ref={echartsRef}
        echarts={echarts}
        option={option}
        notMerge={true}
        onChartReady={onChartReady}
        style={{ width: "100%", height: 300 }}
      />
    </div>
  );
}
