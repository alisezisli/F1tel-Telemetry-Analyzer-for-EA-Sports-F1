"use client";

import type { BestTheoreticalLap as BestTheoResult } from "@/lib/telemetry/analytics/index";
import { fmtLapTime, fmtSectorTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface Props {
  result: BestTheoResult;
}

export function BestTheoreticalLap({ result }: Props) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-6">
      <Sector label="S1" ms={result.sector1_ms} />
      <div className="flex items-center" style={{ color: "var(--muted-foreground)" }}>+</div>
      <Sector label="S2" ms={result.sector2_ms} />
      <div className="flex items-center" style={{ color: "var(--muted-foreground)" }}>+</div>
      <Sector label="S3" ms={result.sector3_ms} />
      <div className="flex items-center" style={{ color: "var(--muted-foreground)" }}>=</div>
      <div className="flex flex-col">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("total")}</span>
        <span className="text-xl font-mono font-bold">{fmtLapTime(result.total_ms)}</span>
        {result.gap_to_best_ms > 0 && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            +{fmtLapTime(result.gap_to_best_ms)} {t("leftOnTable")}
          </span>
        )}
      </div>
    </div>
  );
}

function Sector({ label, ms }: { label: string; ms: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-lg font-mono">{fmtSectorTime(ms)}</span>
    </div>
  );
}
