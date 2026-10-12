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

/**
 * Strip playlist/query junk from a YouTube URL so only the video is fetched.
 * e.g. https://www.youtube.com/watch?v=zWCH8C1oyys&list=RDf9IACA1bjf8&index=16&pp=8AUB
 *   -> https://www.youtube.com/watch?v=zWCH8C1oyys
 * Also canonicalizes youtu.be / shorts / live links. Non-YouTube URLs and
 * explicit /playlist?list=... URLs are returned untouched (just trimmed).
 */
function cleanVideoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const ytHosts = [
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtube-nocookie.com",
      "youtu.be",
    ];
    if (!ytHosts.includes(host)) return trimmed;

    // youtu.be/<id>?list=... -> canonical watch URL
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/watch?v=${id}` : trimmed;
    }

    // Standard watch URLs: keep only ?v=...
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/watch?v=${v}`;

    // /shorts/<id>, /live/<id>, /embed/<id>, /v/<id> -> canonical watch URL
    const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]+)/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;

    return trimmed; // e.g. /playlist?list=... — leave as-is
  } catch {
    return trimmed; // not a valid absolute URL — let the API report the error
  }
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
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
        active
          ? "border-red-500 bg-red-600/20 text-red-300 shadow-[0_0_14px_rgba(239,68,68,0.35)]"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 hover:shadow-[0_0_10px_rgba(255,255,255,0.08)]"
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
  const autoSavedRef = useRef<string | null>(null);

  // The moment a job finishes, push the file to the client's disk via the
  // browser's own download flow (goes to the user's Downloads folder).
  useEffect(() => {
    if (job?.status === "done" && job.filename && autoSavedRef.current !== job.id) {
      autoSavedRef.current = job.id;
      const a = document.createElement("a");
      a.href = `/api/file/${job.id}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [job?.status, job?.id, job?.filename]);

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
        body: JSON.stringify({ url: cleanVideoUrl(url) }),
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
    <div className="vibrant-bg flex min-h-screen flex-1 flex-col items-center px-4 py-12 font-sans text-zinc-100">
      <main className="relative z-10 flex w-full max-w-2xl flex-col gap-6">
        <header className="anim-fade-up flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="anim-bounce-soft">🎬</span>{" "}
              <span className="title-shine">ytbdwnld</span>
            </h1>
            <p className="anim-fade delay-2 text-sm text-zinc-400">
              Paste a video URL. Powered by yt-dlp. Finished files are saved
              straight to your browser&apos;s Downloads folder.
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="All yt-dlp settings"
            className={`relative shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-lg leading-none transition-all duration-300 hover:rotate-45 hover:border-red-500/60 hover:bg-zinc-800 hover:shadow-[0_0_18px_rgba(239,68,68,0.35)] ${
              changedCount > 0 ? "anim-pulse-ring border-red-600/60" : ""
            }`}
          >
            ⚙️
            {changedCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {changedCount}
              </span>
            )}
          </button>
        </header>

        <section className="anim-fade-up delay-1 flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url.trim() && lookup()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-zinc-600 focus:border-red-500 focus:bg-zinc-900/80 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15),0_0_20px_rgba(239,68,68,0.2)]"
          />
          <button
            onClick={lookup}
            disabled={!url.trim() || loadingInfo || !!active}
            className="btn-vibrant rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {loadingInfo ? (
              <span className="flex items-center gap-2">
                <span className="anim-spinner" />
                Fetching…
              </span>
            ) : (
              "Fetch"
            )}
          </button>
        </section>

        {/(youtube\.com\/watch|youtu\.be\/)/.test(url) &&
          /[?&]list=/.test(url) && (
            <p className="anim-fade text-xs text-zinc-500">
              ✂️ Playlist part detected — only the video itself will be fetched.
            </p>
          )}

        {error && (
          <div className="anim-slide-down rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            {error}
          </div>
        )}

        {loadingInfo && (
          <section className="glow-card anim-pop flex flex-col gap-4 rounded-xl p-4">
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-400">
              <span className="anim-bounce-soft">🔍</span>
              <span>
                Fetching video info
                <span className="dot-wave ml-1 inline-flex gap-0.5">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
            </div>
            <div className="flex gap-4">
              <div className="skeleton hidden h-24 w-40 shrink-0 rounded-lg sm:block" />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-2/5 rounded" />
              </div>
            </div>
            <div className="h-px bg-zinc-800" />
            <div className="flex flex-wrap gap-2">
              {[90, 70, 80, 60, 75].map((w, i) => (
                <div
                  key={i}
                  className="skeleton h-7 rounded-full"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <div className="skeleton h-11 w-full rounded-lg" />
          </section>
        )}

        {info && !job && (
          <section className="glow-card anim-pop flex flex-col gap-4 rounded-xl p-4">
            {/* Video header */}
            <div className="anim-fade-up flex gap-4">
              {info.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.thumbnail}
                  alt=""
                  className="hidden h-24 w-40 shrink-0 rounded-lg object-cover shadow-[0_4px_20px_rgba(0,0,0,0.5)] ring-1 ring-zinc-700/60 transition-transform duration-500 hover:scale-[1.03] sm:block"
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
                      className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:scale-[1.05] active:scale-95 ${
                        quality === p.value
                          ? "btn-vibrant text-white"
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
                <div className="anim-fade flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
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
                className="btn-vibrant rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:shadow-none"
              >
                {starting ? (
                  "Starting…"
                ) : (
                  <>
                    <span className="anim-bounce-down">⬇</span> Download
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {job && (
          <section className="glow-card anim-pop flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{job.title || "Download"}</h2>
              <span
                className={`text-xs font-medium uppercase tracking-wider ${
                  active
                    ? "anim-pulse-ring rounded-full bg-red-600/20 px-2 py-0.5 text-red-300"
                    : job.status === "done"
                      ? "rounded-full bg-emerald-600/20 px-2 py-0.5 text-emerald-300"
                      : "text-zinc-400"
                }`}
              >
                {job.status}
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800 ring-1 ring-zinc-700/50">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  active
                    ? "bar-stripes bar-shimmer anim-glow-breathe bg-gradient-to-r from-red-600 via-red-500 to-rose-500"
                    : job.status === "done"
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.6)]"
                      : "bg-red-600"
                }`}
                style={{ width: `${job.percent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span
                className={
                  active ? "font-medium tabular-nums text-red-300" : ""
                }
              >
                {job.percent.toFixed(1)}%
                {job.totalSize ? ` of ${job.totalSize}` : ""}
                {job.speed ? ` · ${job.speed}` : ""}
                {job.eta ? ` · ETA ${job.eta}` : ""}
              </span>
              {active && (
                <button
                  onClick={cancel}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs transition-all duration-200 hover:border-red-700 hover:bg-red-950/60 hover:text-red-300 active:scale-95"
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
              <div className="anim-fade-up flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
                  <span className="truncate text-sm text-emerald-300">
                    <span className="anim-check mr-1.5">✅</span>
                    {job.filename}
                  </span>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = `/api/file/${job.id}`;
                      a.rel = "noopener";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="btn-emerald ml-3 shrink-0 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                  >
                    <span className="anim-bounce-down mr-1 inline-block">⬇</span>
                    Save again
                  </button>
                </div>
                <span className="text-xs text-zinc-500">
                  Saved to your browser&apos;s Downloads folder. If the browser
                  blocked the automatic save, use the button above.
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
