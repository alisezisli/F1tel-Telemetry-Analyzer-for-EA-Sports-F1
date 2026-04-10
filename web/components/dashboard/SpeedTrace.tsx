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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getDrsRanges(frames: TelemetryFrame[], lap: number): Array<[number, number]> {
  const lapFrames = frames
    .filter((f) => f.lap === lap)
    .sort((a, b) => a.lap_distance_m - b.lap_distance_m);

  const ranges: Array<[number, number]> = [];
  let start: number | null = null;

  for (const f of lapFrames) {
    const dist = Math.round(f.lap_distance_m / 5) * 5;
    if (f.drs && start === null) start = dist;
    if (!f.drs && start !== null) {
      ranges.push([start, dist]);
      start = null;
    }
  }
  if (start !== null && lapFrames.length > 0) {
    ranges.push([start, Math.round(lapFrames[lapFrames.length - 1].lap_distance_m / 5) * 5]);
  }
  return ranges;
}

const DownloadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export function SpeedTrace({ frames, laps, groupId, selectedLaps, availableLaps, onToggleLap }: Props) {
  const t = useT();
  const echartsRef = useRef<EChartsReactCore>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownload = useCallback(() => {
    const url = (echartsRef.current as any)?.getEchartsInstance().getDataURL({ type: "png", backgroundColor: "#0a0a0a", pixelRatio: 2 });
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = "speed.png"; a.click();
  }, []);
  const lapInfo = useMemo(() => {
    const m: Record<number, Lap> = {};
    for (const l of laps) m[l.lap_number] = l;
    return m;
  }, [laps]);

  // Pre-compute per-lap DRS lookup: dist -> drs boolean
  const drsLookup = useMemo(() => {
    const lookup: Record<number, Record<number, boolean>> = {};
    for (const lap of selectedLaps) {
      lookup[lap] = {};
      for (const f of frames.filter((f) => f.lap === lap)) {
        const dist = Math.round(f.lap_distance_m / 5) * 5;
        lookup[lap][dist] = f.drs;
      }
    }
    return lookup;
  }, [frames, selectedLaps]);

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
      max: 360,
      axisLabel: { fontSize: 10, color: "#a1a1aa" },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#262626" } },
    },
    series: selectedLaps.map((lap, idx) => {
      const color = COLORS[idx % COLORS.length];
      const drsRanges = getDrsRanges(frames, lap);
      return {
        name: `L${lap}`,
        type: "line" as const,
        data: frames
          .filter((f) => f.lap === lap)
          .map((f) => [Math.round(f.lap_distance_m / 5) * 5, f.speed_kmh]),
        lineStyle: { color, width: 1.5 },
        itemStyle: { color },
        symbol: "none",
        animation: false,
        ...(drsRanges.length > 0 ? {
          markArea: {
            silent: true,
            itemStyle: { color: hexToRgba(color, 0.15) },
            data: drsRanges.map(([s, e]) => [{ xAxis: s }, { xAxis: e }]),
          },
        } : {}),
      };
    }),
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#141414",
      borderColor: "#262626",
      textStyle: { color: "#f5f5f5", fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as Array<{ seriesName: string; value: [number, number] }>;
        const dist = p[0]?.value[0] ?? 0;
        const lines = p.map((item) => {
          const lap = parseInt(item.seriesName.replace("L", ""));
          const drs = drsLookup[lap]?.[dist] ? " · DRS ON" : "";
          return `${item.seriesName}: ${item.value[1].toFixed(0)} km/h${drs}`;
        });
        return `${dist}m<br/>${lines.join("<br/>")}`;
      },
    },
    dataZoom: [{ type: "inside" as const, filterMode: "none" as const, zoomOnMouseWheel: "ctrl" as const }],
  }), [frames, selectedLaps, drsLookup]);

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
      <div className="flex flex-wrap gap-2 mb-4">
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
        style={{ width: "100%", height: 320 }}
      />
    </div>
  );
}
