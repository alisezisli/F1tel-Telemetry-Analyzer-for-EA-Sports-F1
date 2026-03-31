"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { F1TelData } from "@/lib/telemetry/types";
import type { AnalyticsResult } from "@/lib/telemetry/analytics/index";
import { storeSession } from "@/lib/store";

type WorkerMsg =
  | { type: "progress"; pct: number; message: string }
  | { type: "done"; data: F1TelData; analytics: AnalyticsResult }
  | { type: "error"; message: string };

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".f1tel")) {
        setError("Please select a .f1tel file.");
        return;
      }
      setError(null);
      setProgress({ pct: 0, message: "Reading file..." });

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
    [router]
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-12 text-center">
        <div className="mb-3">
          <span
            className="text-4xl font-black tracking-tight"
            style={{ color: "var(--accent)" }}
          >
            F1tel
          </span>
        </div>
        <p style={{ color: "var(--muted-foreground)" }} className="text-sm">
          Upload your{" "}
          <code
            className="font-mono text-xs px-1 py-0.5 rounded"
            style={{ background: "var(--muted)", color: "var(--foreground)" }}
          >
            .f1tel
          </code>{" "}
          file to explore your race telemetry.
          <br />
          Everything is processed locally - your data never leaves your browser.
        </p>
      </div>

      <div className="w-full max-w-lg mb-4 flex justify-center">
        <button
          disabled={!!progress}
          onClick={() => {
            if (progress) return;
            setError(null);
            setProgress({ pct: 0, message: "Loading demo file..." });
            fetch("/demo.f1tel")
              .then((r) => {
                if (!r.ok) throw new Error("Demo file not found on server.");
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
          Try Demo
        </button>
      </div>

      <div
        className={[
          "w-full max-w-lg rounded-xl border-2 border-dashed transition-colors",
          "flex flex-col items-center justify-center gap-4 py-16 px-8",
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
              <p className="text-sm font-medium">Drop your .f1tel file here</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                or click to browse
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Max 20 MB · F1 2025
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-12 flex flex-col items-center gap-2">
        <div className="flex gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <a href="https://alisezisli.com.tr" target="_blank" rel="noopener noreferrer" className="hover:underline">Ali Sezişli</a>
          <a href="https://gnuadm.in" target="_blank" rel="noopener noreferrer" className="hover:underline">GNU Admin</a>
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
      </div>
    </main>
  );
}
