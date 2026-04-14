"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useT } from "@/lib/i18n";
import type { F1TelData } from "@/lib/telemetry/types";
import type { AnalyticsResult } from "@/lib/telemetry/analytics/index";
import { storeSession } from "@/lib/store";

type WorkerMsg =
  | { type: "progress"; pct: number; message: string }
  | { type: "done"; data: F1TelData; analytics: AnalyticsResult }
  | { type: "error"; message: string };

const PREVIEW_IMAGES = [
  {
    src: "/lap-summary.PNG",
    alt: "Lap Summary panel",
    caption: "Lap Summary",
  },
  {
    src: "/sector-analysis.png",
    alt: "Sector Analysis panel",
    caption: "Sector Analysis: Fastest S2 and S3 times on lap 6, right after pit stop.",
  },
  {
    src: "/speed-trace.PNG",
    alt: "Speed Trace panel",
    caption: "Speed Trace: Speed comparison between 1st lap, fastest (2nd) lap and last lap (light rain).",
  },
  {
    src: "/tyre-wear.PNG",
    alt: "Tyre Wear panel",
    caption: "Tyre Wear: Front Left tyre is degrading faster than expected.",
  },
  {
    src: "/stint-comparison.PNG",
    alt: "Stint Comparison panel",
    caption: "Stint Comparison: Cost of intermediate tyres. Fast performance loss with soft tyres.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".f1tel")) {
        setError(t("pleaseSelectFile"));
        return;
      }
      setError(null);
      setProgress({ pct: 0, message: t("readingFile") });

      const worker = new Worker(new URL("@/lib/telemetry/worker.ts", import.meta.url));

      worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setProgress({ pct: msg.pct, message: msg.message });
        } else if (msg.type === "done") {
          const id = crypto.randomUUID();
          storeSession(id, { data: msg.data, analytics: msg.analytics });
          worker.terminate();
          router.push(`/session?id=${id}`);
        } else if (msg.type === "error") {
          setError(msg.message);
          setProgress(null);
          worker.terminate();
        }
      };

      file.arrayBuffer().then((buf) => {
        worker.postMessage({ type: "parse", buffer: buf }, [buf]);
      });
    },
    [router, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16 gap-10">

      {/* Hero */}
      <section className="w-full max-w-2xl flex flex-col items-center text-center gap-6">
        <div>
          <span
            className="text-5xl font-black tracking-tight"
            style={{ color: "var(--accent)" }}
          >
            F1tel
          </span>
        </div>
        <p className="text-lg leading-relaxed" style={{ color: "var(--foreground)" }}>
          {t("tagline")}
        </p>
        <p style={{ color: "var(--muted-foreground)" }} className="text-sm leading-relaxed max-w-xl">
          {t("description")}
        </p>
        <a
          href="https://github.com/alisezisli/F1tel-Telemetry-Analyzer-for-EA-Sports-F1/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {t("downloadGatherer")}
        </a>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {t("freeOpenSource")}
        </p>
      </section>

      {/* Upload */}
      <section className="w-full max-w-lg flex flex-col items-center gap-3">
        <div className="w-full flex justify-center">
          <button
            disabled={!!progress}
            onClick={() => {
              if (progress) return;
              setError(null);
              setProgress({ pct: 0, message: t("loadingDemo") });
              fetch("/demo.f1tel")
                .then((r) => {
                  if (!r.ok) throw new Error(t("demoNotFound"));
                  return r.arrayBuffer();
                })
                .then((buf) => {
                  const worker = new Worker(new URL("@/lib/telemetry/worker.ts", import.meta.url));
                  worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
                    const msg = e.data;
                    if (msg.type === "progress") {
                      setProgress({ pct: msg.pct, message: msg.message });
                    } else if (msg.type === "done") {
                      const id = crypto.randomUUID();
                      storeSession(id, { data: msg.data, analytics: msg.analytics });
                      worker.terminate();
                      router.push(`/session?id=${id}`);
                    } else if (msg.type === "error") {
                      setError(msg.message);
                      setProgress(null);
                      worker.terminate();
                    }
                  };
                  worker.postMessage({ type: "parse", buffer: buf }, [buf]);
                })
                .catch((e) => {
                  setError(e.message);
                  setProgress(null);
                });
            }}
            className="text-sm px-4 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-default"
            style={{
              borderColor: "var(--accent)",
              color: "var(--accent)",
              background: "transparent",
            }}
          >
            {t("tryDemo")}
          </button>
        </div>

        <div
          className={[
            "w-full rounded-xl border-2 border-dashed transition-colors",
            "flex flex-col items-center justify-center gap-4 py-10 px-8",
            progress ? "pointer-events-none opacity-60 cursor-default" : "cursor-pointer",
          ].join(" ")}
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border)",
            background: dragging ? "color-mix(in srgb, var(--accent) 5%, transparent)" : undefined,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !progress && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".f1tel"
            className="hidden"
            onChange={onFileChange}
          />

          {progress ? (
            <div className="w-full flex flex-col items-center gap-3">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {progress.message}
              </p>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${progress.pct}%`, background: "var(--accent)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {progress.pct}%
              </p>
            </div>
          ) : (
            <>
              <div className="text-4xl select-none">📁</div>
              <div className="text-center">
                <p className="text-sm font-medium">{t("dropFile")}</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {t("orClickToBrowse")}
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t("maxSize")}
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </section>

      {/* Patreon Banner */}
      <a
        href="https://www.patreon.com/AliSezisli"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-3xl flex justify-center"
      >
        <img
          src="/patreon.png"
          alt="Support on Patreon"
          className="rounded-lg"
          style={{ maxHeight: "80px" }}
        />
      </a>

      {/* Demo Video */}
      <section className="w-full max-w-3xl flex flex-col gap-4">
        <h2 className="text-base font-semibold text-center" style={{ color: "var(--muted-foreground)" }}>
          {t("seeItInAction")}
        </h2>
        <div className="relative w-full aspect-video rounded-xl overflow-hidden" style={{ background: "var(--card)" }}>
          <iframe
            src="https://www.youtube.com/embed/CJ3XDsM6Q3k?si=6YX6C5q4HfFWlQz4"
            title="F1tel Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: "none" }}
          />
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="w-full max-w-3xl flex flex-col gap-4">
        <h2 className="text-base font-semibold text-center" style={{ color: "var(--muted-foreground)" }}>
          {t("dashboard")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PREVIEW_IMAGES.slice(0, 4).map((img) => (
            <figure key={img.src} className="flex flex-col gap-2">
              <button
                className="relative w-full aspect-video rounded-lg overflow-hidden cursor-zoom-in"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                onClick={() => setLightbox({ src: img.src, alt: img.alt })}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover transition-transform duration-200 hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </button>
              <figcaption className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex justify-center">
          <figure className="flex flex-col gap-2 w-full sm:w-1/2">
            <button
              className="relative w-full aspect-video rounded-lg overflow-hidden cursor-zoom-in"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              onClick={() => setLightbox({ src: PREVIEW_IMAGES[4].src, alt: PREVIEW_IMAGES[4].alt })}
            >
              <Image
                src={PREVIEW_IMAGES[4].src}
                alt={PREVIEW_IMAGES[4].alt}
                fill
                className="object-cover transition-transform duration-200 hover:scale-105"
                sizes="(max-width: 640px) 100vw, 25vw"
              />
            </button>
            <figcaption className="text-xs px-1 text-center" style={{ color: "var(--muted-foreground)" }}>
              {PREVIEW_IMAGES[4].caption}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-8 right-0 text-sm"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => setLightbox(null)}
            >
              Close
            </button>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden">
              <Image
                src={lightbox.src}
                alt={lightbox.alt}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2">
        <div className="flex gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <a href="https://alisezisli.com.tr" target="_blank" rel="noopener noreferrer" className="hover:underline">Ali Sezişli</a>
          <a href="https://linuxhate.com" target="_blank" rel="noopener noreferrer" className="hover:underline">Linux Hate</a>
        </div>
        <a
          href="https://github.com/alisezisli/F1tel-Telemetry-Analyzer-for-EA-Sports-F1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline"
          style={{ color: "var(--muted-foreground)" }}
        >
          Get F1tel Gatherer
        </a>
        <a
          href="https://github.com/alisezisli/F1tel-Telemetry-Analyzer-for-EA-Sports-F1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs hover:underline"
          style={{ color: "var(--muted-foreground)" }}
        >
          Source Code on GitHub
        </a>
      </footer>
    </main>
  );
}
