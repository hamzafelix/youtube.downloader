import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { AdvancedSettings, DEFAULT_SETTINGS, buildAdvancedArgs } from "./settings";

/** Absolute path to the yt-dlp executable (override with YTDLP_PATH env var). */
export const YTDLP_PATH =
  process.env.YTDLP_PATH ||
  "C:\\Users\\hamza\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\yt-dlp.exe";

/** Where finished files land. */
export const DOWNLOADS_DIR = path.join(process.cwd(), "downloads");

if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true });

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

/** Fetch metadata for a URL. Playlists are detected (not expanded). */
export async function fetchInfo(url: string): Promise<VideoInfo> {
  const args = ["-J", "--flat-playlist", "--no-warnings", "--skip-download", "--js-runtimes", "node", url];
  const res = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Timed out fetching video info")); }
    }, INFO_TIMEOUT_MS);
    try {
      const proc = spawn(YTDLP_PATH, args, { windowsHide: true });
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
    path.join(DOWNLOADS_DIR, adv.outputTemplate.trim() || "%(title)s [%(id)s].%(ext)s"),
  );
  args.push(...buildAdvancedArgs(adv));
  args.push(opts.url);

  job.status = "starting";
  job.log = [`$ yt-dlp ${args.join(" ")}`];

  const proc = spawn(YTDLP_PATH, args, { windowsHide: true });
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
