"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { LapSummaryTable } from "@/components/dashboard/LapSummaryTable";
import { SpeedTrace } from "@/components/dashboard/SpeedTrace";
import { ThrottleBrake } from "@/components/dashboard/ThrottleBrake";
import { SectorBars } from "@/components/dashboard/SectorBars";
import { TyreTemperature } from "@/components/dashboard/TyreTemperature";
import { BrakeTemperature } from "@/components/dashboard/BrakeTemperature";
import { StintComparison } from "@/components/dashboard/StintComparison";
import { BestTheoreticalLap } from "@/components/dashboard/BestTheoreticalLap";
import { TyreWear } from "@/components/dashboard/TyreWear";
import { fmtLapTime } from "@/lib/utils";
import { getSession } from "@/lib/store";
import type { SessionPayload } from "@/lib/store";

export default function SessionPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted-foreground)" }}>Loading...</p>
      </main>
    }>
      <SessionContent />
    </Suspense>
  );
}

function SessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useT();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) { setNotFound(true); return; }
    const payload = getSession(id);
    if (!payload) { setNotFound(true); return; }
    try {
      setPayload(payload);
    } catch {
      setNotFound(true);
    }
  }, [searchParams]);

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium">{t("sessionNotFound")}</p>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t("sessionMemoryNote")}
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 px-4 py-2 rounded text-sm font-medium"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {t("uploadAFile")}
        </button>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--muted-foreground)" }}>{t("loading")}</p>
      </main>
    );
  }

  return <SessionDashboard payload={payload} />;
}  // end SessionContent

function SessionDashboard({ payload }: { payload: SessionPayload }) {
  const router = useRouter();
  const t = useT();
  const { data, analytics } = payload;
  const { session, player } = data;

  const availableLaps = useMemo(
    () => [...new Set(data.telemetry_frames.map((f) => f.lap))].sort((a, b) => a - b),
    [data.telemetry_frames]
  );
  const [selectedLaps, setSelectedLaps] = useState<number[]>(() => availableLaps.slice(0, 2));
  const toggleLap = (lap: number) => {
    setSelectedLaps((prev) =>
      prev.includes(lap) ? prev.filter((l) => l !== lap) : [...prev, lap].slice(-5)
    );
  };

  return (
    <main className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap pr-20">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.push("/")}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {t("uploadBack")}
            </button>
            <span className="text-xl font-bold">{session.track_name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {session.type}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {player.name} · {player.team} · {session.total_laps} {t("laps")} ·{" "}
            {(session.track_length_m / 1000).toFixed(3)} km ·{" "}
            {session.weather} · Air {session.air_temp_c}°C · Track {session.track_temp_c}°C ·{" "}
            {new Date(data.captured_at).toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            {t("zoomHint")}
          </p>
        </div>
        {analytics.bestTheoreticalLap && (
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("bestTheoretical")}</p>
            <p className="text-lg font-mono font-bold">
              {fmtLapTime(analytics.bestTheoreticalLap.total_ms)}
            </p>
            {analytics.bestTheoreticalLap.gap_to_best_ms > 0 && (
              <p className="text-xs" style={{ color: "var(--accent)" }}>
                +{fmtLapTime(analytics.bestTheoreticalLap.gap_to_best_ms)} {t("potential")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Panels */}
      <div className="flex flex-col gap-6">
        <Card title={t("panelLapSummary")}>
          <LapSummaryTable laps={analytics.lapDelta} />
        </Card>

        {analytics.bestTheoreticalLap && (
          <Card title={t("panelBestTheoreticalLap")}>
            <BestTheoreticalLap result={analytics.bestTheoreticalLap} />
          </Card>
        )}

        <Card title={t("panelSectorAnalysis")}>
          <SectorBars laps={data.laps} />
        </Card>

        <SectionDivider title={t("sectionLapAnalysis")} />

        <Card title={t("panelSpeedTrace")}>
          <SpeedTrace
            frames={data.telemetry_frames}
            laps={data.laps}
            groupId="f1tel-trace"
            selectedLaps={selectedLaps}
            availableLaps={availableLaps}
            onToggleLap={toggleLap}
          />
        </Card>

        <Card title={t("panelThrottleBrake")}>
          <ThrottleBrake
            frames={data.telemetry_frames}
            laps={data.laps}
            groupId="f1tel-trace"
            selectedLaps={selectedLaps}
            availableLaps={availableLaps}
            onToggleLap={toggleLap}
          />
        </Card>

        {analytics.stintComparison.length > 1 && (
          <Card title={t("panelStintComparison")}>
            <StintComparison stints={analytics.stintComparison} />
          </Card>
        )}

        <SectionDivider title={t("sectionTyresBrakes")} />

        <Card title={t("panelTyreSurfaceTemp")}>
          <TyreTemperature frames={data.telemetry_frames} groupId="f1tel-thermal" />
        </Card>

        <Card title={t("panelBrakeTemp")}>
          <BrakeTemperature frames={data.telemetry_frames} groupId="f1tel-thermal" />
        </Card>

        <Card title={t("panelTyreWear")}>
          <TyreWear frames={data.telemetry_frames} groupId="f1tel-thermal" />
        </Card>
      </div>
    </main>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="w-1 h-4 rounded-full" style={{ background: "var(--accent)" }} />
      <span className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted-foreground)" }}>
        {title}
      </span>
      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--muted-foreground)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
