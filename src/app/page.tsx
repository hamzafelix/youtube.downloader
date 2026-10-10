"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SettingsModal from "@/components/SettingsModal";
import {
  AdvancedSettings,
  DEFAULT_SETTINGS,
  countChanged,
  parseAdvancedSettings,
} from "@/lib/settings";

const SETTINGS_KEY = "ytbdwnld:advanced";

type JobStatus = "starting" | "downloading" | "merging" | "done" | "error";

interface VideoInfo {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  isPlaylist: boolean;
  playlistCount: number | null;
  webpageUrl: string;
}

interface JobState {
  id: string;
  status: JobStatus;
  title: string;
  filename: string | null;
  percent: number;
  speed: string | null;
  eta: string | null;
  totalSize: string | null;
  error: string | null;
}

const QUALITY_PRESETS = [
  { value: "best", label: "Best" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
  { value: "audio", label: "Audio" },
];

const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav", "best"];
const AUDIO_QUALITIES = ["0", "2", "4", "6", "8", "10"];

function fmtDuration(s: number | null): string {
  if (s === null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function Pill({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-red-500 bg-red-600/20 text-red-300"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("best");
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load advanced settings once, then persist every change.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) setAdvanced(parseAdvancedSettings(JSON.parse(raw)));
      } catch {
        /* ignore malformed saved settings */
      }
    });
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(advanced));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [advanced]);

  // SSE progress subscription
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const es = new EventSource(`/api/progress/${job.id}`);
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as JobState;
      setJob(data);
      if (data.status === "done" || data.status === "error") es.close();
    };
    es.addEventListener("end", () => es.close());
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [job?.id]);

  const lookup = useCallback(async () => {
    setError(null);
    setInfo(null);
    setJob(null);
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not fetch video info");
      setInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingInfo(false);
    }
  }, [url]);

  const startDownload = useCallback(async () => {
    if (!info) return;
    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: info.webpageUrl, quality, advanced }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start download");
      setJob({
        id: data.jobId,
        status: "starting",
        title: info.title,
        filename: null,
        percent: 0,
        speed: null,
        eta: null,
        totalSize: null,
        error: null,
      });
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setStarting(false);
    }
  }, [info, quality, advanced]);

  const cancel = useCallback(async () => {
    if (!job) return;
    await fetch(`/api/cancel/${job.id}`, { method: "POST" });
  }, [job]);

  const set = <K extends keyof AdvancedSettings>(k: K, v: AdvancedSettings[K]) =>
    setAdvanced((s) => ({ ...s, [k]: v }));

  const subsOn = advanced.writeSubs || advanced.embedSubs || advanced.writeAutoSubs;
  const toggleSubs = () => {
    const on = !subsOn;
    setAdvanced((s) => ({ ...s, writeSubs: on, embedSubs: on }));
  };
  const changedCount = countChanged(advanced);

  const active = job && job.status !== "done" && job.status !== "error";
  const audioPreset = quality === "audio";

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center bg-zinc-950 px-4 py-12 font-sans text-zinc-100">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">🎬 ytbdwnld</h1>
            <p className="text-sm text-zinc-400">
              Paste a video URL. Powered by yt-dlp. Files land in{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
                ytbdwnld/downloads/
              </code>
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="All yt-dlp settings"
            className="relative shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-lg leading-none transition-colors hover:bg-zinc-800"
          >
            ⚙️
            {changedCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {changedCount}
              </span>
            )}
          </button>
        </header>

        <section className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url.trim() && lookup()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-red-500"
          />
          <button
            onClick={lookup}
            disabled={!url.trim() || loadingInfo || !!active}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingInfo ? "Fetching…" : "Fetch"}
          </button>
        </section>

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {info && !job && (
          <section className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            {/* Video header */}
            <div className="flex gap-4">
              {info.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.thumbnail}
                  alt=""
                  className="hidden h-24 w-40 shrink-0 rounded-lg object-cover sm:block"
                />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="font-semibold leading-snug">{info.title}</h2>
                <p className="text-sm text-zinc-400">
                  {info.uploader ?? "Unknown channel"} · {fmtDuration(info.duration)}
                  {info.isPlaylist ? ` · Playlist · ${info.playlistCount} videos` : ""}
                </p>
              </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Quality presets */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-1 flex-wrap gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                  {QUALITY_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setQuality(p.value)}
                      className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        quality === p.value
                          ? "bg-red-600 text-white"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio options — only when the Audio preset is selected */}
              {audioPreset && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-500">Format</span>
                  {AUDIO_FORMATS.map((f) => (
                    <Pill
                      key={f}
                      active={advanced.audioFormat === f}
                      onClick={() => set("audioFormat", f)}
                    >
                      {f}
                    </Pill>
                  ))}
                  <span className="ml-2 text-xs font-medium text-zinc-500">Quality</span>
                  {AUDIO_QUALITIES.map((q) => (
                    <Pill
                      key={q}
                      active={advanced.audioQuality === q}
                      onClick={() => set("audioQuality", q)}
                      title={`VBR ${q} (0 = best, 10 = worst)`}
                    >
                      {q}
                    </Pill>
                  ))}
                </div>
              )}

              {/* Quick options */}
              <div className="flex flex-wrap items-center gap-2">
                <Pill active={subsOn} onClick={toggleSubs} title="Write + embed subtitles">
                  💬 Subtitles
                </Pill>
                <Pill
                  active={advanced.embedThumbnail}
                  onClick={() => set("embedThumbnail", !advanced.embedThumbnail)}
                  title="Embed thumbnail into the file"
                >
                  🖼 Thumbnail
                </Pill>
                <Pill
                  active={advanced.embedMetadata}
                  onClick={() => set("embedMetadata", !advanced.embedMetadata)}
                  title="Embed metadata tags"
                >
                  🏷 Metadata
                </Pill>
                <Pill
                  active={advanced.embedChapters}
                  onClick={() => set("embedChapters", !advanced.embedChapters)}
                  title="Embed chapter markers"
                >
                  📖 Chapters
                </Pill>
                {info.isPlaylist && (
                  <Pill
                    active={advanced.downloadPlaylist}
                    onClick={() => set("downloadPlaylist", !advanced.downloadPlaylist)}
                    title={
                      advanced.downloadPlaylist
                        ? "Downloading the whole playlist"
                        : "Only the first video will be downloaded"
                    }
                  >
                    📚 Whole playlist
                  </Pill>
                )}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="ml-auto text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  All settings →
                </button>
              </div>

              <button
                onClick={startDownload}
                disabled={starting}
                className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
              >
                {starting ? "Starting…" : "⬇ Download"}
              </button>
            </div>
          </section>
        )}

        {job && (
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{job.title || "Download"}</h2>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                {job.status}
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-red-600 transition-all duration-300"
                style={{ width: `${job.percent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span>
                {job.percent.toFixed(1)}%
                {job.totalSize ? ` of ${job.totalSize}` : ""}
                {job.speed ? ` · ${job.speed}` : ""}
                {job.eta ? ` · ETA ${job.eta}` : ""}
              </span>
              {active && (
                <button
                  onClick={cancel}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                >
                  Cancel
                </button>
              )}
            </div>

            {job.status === "merging" && (
              <p className="text-xs text-zinc-400">
                Merging video + audio with ffmpeg… (bar may sit at 100%)
              </p>
            )}

            {job.status === "done" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2">
                  <span className="truncate text-sm text-emerald-300">
                    {job.filename}
                  </span>
                  <a
                    href={`/api/file/${job.id}`}
                    className="ml-3 shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    ⬇ Save to browser
                  </a>
                </div>
                <span className="text-xs text-zinc-500">
                  Also saved on disk in <code>ytbdwnld/downloads/</code>
                </span>
              </div>
            )}

            {job.status === "error" && (
              <p className="text-sm text-red-400">{job.error}</p>
            )}
          </section>
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={advanced}
        onChange={setAdvanced}
      />
    </div>
  );
}
