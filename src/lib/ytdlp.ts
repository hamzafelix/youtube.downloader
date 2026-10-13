import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import os from "os";
import path from "path";
import { AdvancedSettings, DEFAULT_SETTINGS, buildAdvancedArgs } from "./settings";

/** Absolute path to the yt-dlp executable (override with YTDLP_PATH env var). */
export const YTDLP_PATH =
  process.env.YTDLP_PATH ||
  "C:\\Users\\hamza\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\yt-dlp.exe";

/**
 * Temporary staging area for in-flight downloads. This is NOT the final
 * destination — files here are streamed to the client's browser and deleted
 * from the server as soon as they've been delivered (or if they go stale).
 */
export const STAGING_DIR = path.join(os.tmpdir(), "ytbdwnld-staging");

/**
 * yt-dlp is a Python program. When its stdout is a pipe on Windows, Python
 * defaults to the locale codepage (e.g. cp1252), so non-ASCII characters in
 * titles — like the FILEPATH line we parse — come through mangled (usually as
 * "?"). Forcing UTF-8 on both the Python runtime and the pipe keeps the
 * captured filename byte-identical to the one on disk.
 */
const YTDLP_ENV = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  PYTHONUTF8: "1",
};

if (!existsSync(STAGING_DIR)) mkdirSync(STAGING_DIR, { recursive: true });

/** Files untouched for longer than this are swept from staging. */
const STALE_FILE_MS = 60 * 60 * 1000;

/** Delete a staged file, ignoring errors (it may already be gone). */
export function deleteStagedFile(filename: string | null | undefined): void {
  if (!filename) return;
  try {
    unlinkSync(path.join(STAGING_DIR, filename));
  } catch {
    /* already deleted or never existed */
  }
}

/** Remove stale leftovers from previous runs (crashed jobs, never-fetched files). */
export function sweepStaleFiles(): void {
  try {
    const cutoff = Date.now() - STALE_FILE_MS;
    for (const name of readdirSync(STAGING_DIR)) {
      const full = path.join(STAGING_DIR, name);
      try {
        if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
      } catch {
        /* file vanished mid-sweep */
      }
    }
  } catch {
    /* staging dir unreadable — nothing to do */
  }
}
sweepStaleFiles();

export type JobStatus = "starting" | "downloading" | "merging" | "done" | "error";

export interface Job {
  id: string;
  url: string;
  quality: string;
  status: JobStatus;
  title: string;
  filename: string | null;
  percent: number;
  speed: string | null;
  eta: string | null;
  totalSize: string | null;
  log: string[];
  error: string | null;
  createdAt: number;
  process: ChildProcessWithoutNullStreams | null;
}

/** In-memory job registry — fine for a local single-user app. */
export const jobs = new Map<string, Job>();

export const QUALITY_PRESETS: Record<string, { args: string[]; label: string }> = {
  best: { args: ["-f", "bv*+ba/b"], label: "Best available" },
  "1080": { args: ["-f", "bv*[height<=1080]+ba/b[height<=1080]"], label: "1080p max" },
  "720": { args: ["-f", "bv*[height<=720]+ba/b[height<=720]"], label: "720p max" },
  "480": { args: ["-f", "bv*[height<=480]+ba/b[height<=480]"], label: "480p max" },
  audio: { args: ["-f", "ba/b"], label: "Audio only" },
};

export interface VideoInfo {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  isPlaylist: boolean;
  playlistCount: number | null;
  webpageUrl: string;
}

const INFO_TIMEOUT_MS = 30_000;

/**
 * Server-side fallback for YouTube's "Sign in to confirm you're not a bot"
 * check, which datacenter IPs (VPS/cloud deployments) hit without cookies.
 * We ask via player clients that are currently checked less aggressively
 * and pace requests so traffic looks human. Skipped when the client already
 * passed its own --extractor-args (avoids conflicting client overrides).
 * These flags are cat-and-mouse: if the error returns, swap the client list
 * (try "mweb", "android_vr") and rebuild for a fresh yt-dlp.
 */
const PLAYER_CLIENT_FALLBACK = ["--extractor-args", "youtube:player_client=tv,web_safari"];
const RATE_FALLBACK = ["--sleep-requests", "2", "--sleep-interval", "5", "--max-sleep-interval", "10"];

function withBotFallbacks(args: string[], includeRate: boolean): string[] {
  if (args.some((a) => a.startsWith("--extractor-args"))) return args;
  return [...args, ...(includeRate ? [...PLAYER_CLIENT_FALLBACK, ...RATE_FALLBACK] : PLAYER_CLIENT_FALLBACK)];
}

/** Fetch metadata for a URL. Playlists are detected (not expanded). */
export async function fetchInfo(url: string): Promise<VideoInfo> {
  const args = withBotFallbacks(
    ["-J", "--flat-playlist", "--no-warnings", "--skip-download", "--js-runtimes", "node"],
    false,
  );
  args.push(url);
  const res = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Timed out fetching video info")); }
    }, INFO_TIMEOUT_MS);
    try {
      const proc = spawn(YTDLP_PATH, args, { windowsHide: true, env: YTDLP_ENV });
      let stdout = "", stderr = "";
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", (e) => { if (!settled) { settled = true; clearTimeout(to); reject(e); } });
      proc.on("close", (code) => {
        if (!settled) { settled = true; clearTimeout(to); resolve({ code: code ?? 1, stdout, stderr }); }
      });
    } catch (e) { clearTimeout(to); reject(e); }
  });

  if (res.code !== 0 || !res.stdout.trim()) {
    const detail = res.stderr.trim().split("\n").filter(Boolean).pop() || "yt-dlp failed to extract info";
    throw new Error(detail);
  }

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(res.stdout);
  } catch {
    throw new Error("Could not parse yt-dlp output");
  }

  const isPlaylist = meta._type === "playlist";
  return {
    id: String(meta.id ?? ""),
    title: String(meta.title ?? "Untitled"),
    duration: typeof meta.duration === "number" ? meta.duration : null,
    thumbnail: typeof meta.thumbnail === "string" ? meta.thumbnail : null,
    uploader: typeof meta.uploader === "string" ? meta.uploader : null,
    isPlaylist,
    playlistCount: isPlaylist && Array.isArray(meta.entries) ? meta.entries.length : null,
    webpageUrl: String(meta.webpage_url ?? url),
  };
}

export interface DownloadOptions {
  url: string;
  quality: string;
  jobId: string;
  advanced?: AdvancedSettings;
}

const PERCENT_RE = /\[PROGRESS\]\s+([\d.]+)% of\s+~?\s*([\d.]+\w+|N\/?A|Unknown)(?:\s+at\s+([\d.]+\w+\/s|Unknown(?:\s*B\/s)?))?(?:\s+ETA\s+([\d:]+|N\/?A|Unknown))?/;
const NA_RE = /^(N\/?A|Unknown)$/;

/** Start a download job and wire its stdout/stderr into the job record. */
export function startDownload(opts: DownloadOptions): Job {
  const job = jobs.get(opts.jobId);
  if (!job) throw new Error(`Unknown job ${opts.jobId}`);

  const adv = opts.advanced ?? DEFAULT_SETTINGS;
  const preset = QUALITY_PRESETS[opts.quality] ?? QUALITY_PRESETS.best;

  const args: string[] = [];
  if (adv.format.trim()) {
    args.push("-f", adv.format.trim());
  } else {
    args.push(...preset.args);
  }
  if (opts.quality === "audio") {
    args.push("-x", "--audio-format", adv.audioFormat.trim() || "mp3");
    if (adv.audioQuality.trim()) args.push("--audio-quality", adv.audioQuality.trim());
  }
  args.push(adv.downloadPlaylist ? "--yes-playlist" : "--no-playlist");
  args.push(
    "--newline",
    "--progress",
    "--js-runtimes",
    "node",
    "--windows-filenames",
    "--progress-template",
    "download:[PROGRESS] %(progress._percent_str)s of %(progress._total_bytes_estimate_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s",
    "--print",
    "after_move:FILEPATH:%(filepath)s",
    "-o",
    path.join(STAGING_DIR, adv.outputTemplate.trim() || "%(title)s [%(id)s].%(ext)s"),
  );
  args.push(...withBotFallbacks(buildAdvancedArgs(adv), true));
  args.push(opts.url);

  job.status = "starting";
  job.log = [`$ yt-dlp ${args.join(" ")}`];

  const proc = spawn(YTDLP_PATH, args, { windowsHide: true, env: YTDLP_ENV });
  job.process = proc;

  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      job.log.push(line);
      if (job.log.length > 500) job.log.splice(0, job.log.length - 500);

      if (line.startsWith("FILEPATH:")) {
        job.filename = path.basename(line.slice("FILEPATH:".length).trim());
        continue;
      }
      if (line.startsWith("[Merger]") || line.startsWith("[ExtractAudio]")) {
        job.status = "merging";
        continue;
      }
      const m = line.match(PERCENT_RE);
      if (m) {
        job.status = "downloading";
        job.percent = Math.min(100, parseFloat(m[1]));
        job.totalSize = m[2] && !NA_RE.test(m[2]) ? m[2] : null;
        job.speed = m[3] && !NA_RE.test(m[3]) ? m[3] : null;
        job.eta = m[4] && !NA_RE.test(m[4]) ? m[4] : null;
      }
    }
  });

  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      job.log.push(`[stderr] ${line}`);
      if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
    }
  });

  proc.on("error", (err) => {
    job.status = "error";
    job.error = `Failed to launch yt-dlp: ${err.message}`;
  });

  proc.on("close", (code) => {
    if (job.status !== "error") {
      job.status = code === 0 ? "done" : "error";
      job.percent = code === 0 ? 100 : job.percent;
      if (code !== 0) {
        const errLine = [...job.log].reverse().find((l) => l.startsWith("[stderr] ERROR"));
        job.error = errLine ? errLine.replace("[stderr] ", "") : `yt-dlp exited with code ${code}`;
      }
    }
    job.process = null;
  });

  return job;
}
