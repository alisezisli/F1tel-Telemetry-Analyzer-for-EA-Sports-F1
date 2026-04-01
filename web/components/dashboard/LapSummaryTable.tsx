"use client";

import type { LapDeltaRow } from "@/lib/telemetry/analytics/index";
import { fmtLapTime, fmtSectorTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  laps: LapDeltaRow[];
}

export function LapSummaryTable({ laps }: Props) {
  const t = useT();
  if (laps.length === 0) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("noLapData")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
            <th className="text-left py-2 pr-4 font-medium">{t("colLap")}</th>
            <th className="text-right py-2 px-4 font-medium">{t("colTime")}</th>
            <th className="text-right py-2 px-4 font-medium">{t("colDelta")}</th>
            <th className="text-right py-2 px-4 font-medium">S1</th>
            <th className="text-right py-2 px-4 font-medium">S2</th>
            <th className="text-right py-2 px-4 font-medium">S3</th>
            <th className="text-right py-2 px-4 font-medium">{t("colPit")}</th>
            <th className="text-center py-2 px-4 font-medium">{t("colValid")}</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => (
            <tr
              key={lap.lap_number}
              className="border-b"
              style={{
                borderColor: "var(--border)",
                background: lap.is_best ? "color-mix(in srgb, var(--accent) 8%, transparent)" : undefined,
              }}
            >
              <td className="py-2 pr-4 font-mono">
                {lap.is_best && (
                  <span className="mr-1.5 text-xs" style={{ color: "var(--accent)" }}>●</span>
                )}
                {lap.lap_number}
              </td>
              <td className="text-right py-2 px-4 font-mono">
                {fmtLapTime(lap.lap_time_ms)}
              </td>
              <td className="text-right py-2 px-4 font-mono">
                {lap.delta_ms === null ? "-" : lap.is_best ? t("best") : `+${fmtSectorTime(lap.delta_ms)}`}
              </td>
              <td className="text-right py-2 px-4 font-mono text-xs">
                {fmtSectorTime(lap.sector1_ms)}
              </td>
              <td className="text-right py-2 px-4 font-mono text-xs">
                {fmtSectorTime(lap.sector2_ms)}
              </td>
              <td className="text-right py-2 px-4 font-mono text-xs">
                {fmtSectorTime(lap.sector3_ms)}
              </td>
              <td className="py-2 px-4 text-xs font-mono text-right whitespace-nowrap">
                {lap.pit_in && (
                  <span>
                    🔧
                    {lap.pit_stop_time_ms && lap.pit_lane_time_ms
                      ? ` ${(lap.pit_stop_time_ms / 1000).toFixed(2)}s / ${(lap.pit_lane_time_ms / 1000).toFixed(2)}s`
                      : lap.pit_stop_time_ms
                      ? ` ${(lap.pit_stop_time_ms / 1000).toFixed(2)}s`
                      : ""}
                  </span>
                )}
              </td>
              <td className="text-center py-2 px-4">
                <span style={{ color: lap.valid ? "#22c55e" : "#ef4444" }}>
                  {lap.valid ? "✓" : "✗"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
