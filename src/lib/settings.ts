/**
 * Advanced yt-dlp settings surfaced on the frontend.
 *
 * Each field maps 1:1 to a yt-dlp CLI option (see `buildAdvancedArgs`).
 * Values are plain strings/booleans so they survive JSON round-trips and
 * localStorage persistence.
 */
export interface AdvancedSettings {
  // ── Format ────────────────────────────────────────────────────────────────
  /** Custom format selector, overrides the quality preset when set. (-f) */
  format: string;
  /** Remux the output container without re-encoding. (--remux-video) */
  remuxVideo: string; // "" | mp4 | mkv | webm | avi | flv | mov | ...

  // ── Playlist / selection ──────────────────────────────────────────────────
  /** Download whole playlists instead of only the current video. */
  downloadPlaylist: boolean;
  /** Which playlist items to download, e.g. "1:5,8". (--playlist-items) */
  playlistItems: string;

  // ── Download behaviour ────────────────────────────────────────────────────
  /** Max download rate, e.g. "500K" or "4.2M". (-r/--limit-rate) */
  rateLimit: string;
  /** How many times to retry a download, or "infinite". (--retries) */
  retries: string;
  /** Retries per fragment (DASH/HLS), or "infinite". (--fragment-retries) */
  fragmentRetries: string;
  /** Concurrent fragment downloads (DASH/HLS). (-N/--concurrent-fragments) */
  concurrentFragments: string;
  /** Size of the download buffer, e.g. "16M". (--buffer-size) */
  bufferSize: string;
  /** Overwrite already-downloaded files. (--force-overwrites) */
  forceOverwrites: boolean;
  /** Do not resume partially downloaded files. (--no-continue) */
  noResume: boolean;
  /** Do not use .part files; write directly to the target. (--no-part) */
  noPart: boolean;
  /** Keep the pre-merge video file after merging. (--keep-video) */
  keepVideo: boolean;
  /** Use the server's Last-Modified header as file mtime (off = --no-mtime). */
  fileMtime: boolean;

  // ── Audio ─────────────────────────────────────────────────────────────────
  /** Audio container used when extracting audio ("Audio only" preset). (-x --audio-format) */
  audioFormat: string; // mp3 | m4a | opus | flac | wav | aac | vorbis | best
  /** VBR quality 0 (best) … 10 (worst). (--audio-quality) */
  audioQuality: string;

  // ── Subtitles ─────────────────────────────────────────────────────────────
  /** Write subtitle files. (--write-subs) */
  writeSubs: boolean;
  /** Write auto-generated subtitles. (--write-auto-subs) */
  writeAutoSubs: boolean;
  /** Comma-separated subtitle languages, e.g. "en,ja,en-orig". (--sub-langs) */
  subLangs: string;
  /** Embed subtitles into the output container. (--embed-subs) */
  embedSubs: boolean;
  /** Convert subtitles to this format. (--convert-subs) */
  convertSubs: string; // "" | srt | vtt | ass | lrc

  // ── Metadata, thumbnails, chapters ───────────────────────────────────────
  /** Embed the thumbnail into the file. (--embed-thumbnail) */
  embedThumbnail: boolean;
  /** Embed metadata tags. (--embed-metadata) */
  embedMetadata: boolean;
  /** Embed chapter markers. (--embed-chapters) */
  embedChapters: boolean;
  /** Write a .description file. (--write-description) */
  writeDescription: boolean;
  /** Write the thumbnail as an image file. (--write-thumbnail) */
  writeThumbnail: boolean;
  /** Write the raw video metadata as .info.json. (--write-info-json) */
  writeInfoJson: boolean;

  // ── Output ────────────────────────────────────────────────────────────────
  /** Output filename template relative to downloads/, e.g. "%(uploader)s/%(title)s.%(ext)s". (-o) */
  outputTemplate: string;
  /** Restrict filenames to ASCII. (--restrict-filenames) */
  restrictFilenames: boolean;
  /** Trim filenames to N characters. (--trim-filenames) */
  trimFilenames: string;

  // ── Network ───────────────────────────────────────────────────────────────
  /** HTTP/SOCKS proxy URL, e.g. "socks5://127.0.0.1:1080". (--proxy) */
  proxy: string;
  /** Socket timeout in seconds. (--socket-timeout) */
  socketTimeout: string;
  /** Client-side IP address to bind to. (--source-address) */
  sourceAddress: string;
  /** Force IPv4. (-4) */
  forceIpv4: boolean;
  /** Force IPv6. (-6) */
  forceIpv6: boolean;

  // ── Authentication ────────────────────────────────────────────────────────
  /** Account username. (-u) */
  username: string;
  /** Account password. (-p) */
  password: string;
  /** Video password (for protected videos). (--video-password) */
  videoPassword: string;
  /** Read cookies from a browser: chrome | firefox | edge | brave | vivaldi | safari. (--cookies-from-browser) */
  cookiesFromBrowser: string;
  /** Path to a Netscape-format cookies.txt file. (--cookies) */
  cookiesFile: string;

  // ── SponsorBlock ──────────────────────────────────────────────────────────
  /** SponsorBlock categories to cut out, e.g. "sponsor,selfpromo,interaction". (--sponsorblock-remove) */
  sponsorblockRemove: string;
  /** SponsorBlock categories to mark with chapters. (--sponsorblock-mark) */
  sponsorblockMark: string;

  // ── Raw passthrough ───────────────────────────────────────────────────────
  /** Extra raw yt-dlp CLI arguments, whitespace-separated (quotes supported). */
  extraArgs: string;
}

export const DEFAULT_SETTINGS: AdvancedSettings = {
  format: "",
  remuxVideo: "",
  downloadPlaylist: false,
  playlistItems: "",
  rateLimit: "",
  retries: "",
  fragmentRetries: "",
  concurrentFragments: "",
  bufferSize: "",
  forceOverwrites: false,
  noResume: false,
  noPart: false,
  keepVideo: false,
  fileMtime: false,
  audioFormat: "mp3",
  audioQuality: "0",
  writeSubs: false,
  writeAutoSubs: false,
  subLangs: "",
  embedSubs: false,
  convertSubs: "",
  embedThumbnail: false,
  embedMetadata: false,
  embedChapters: false,
  writeDescription: false,
  writeThumbnail: false,
  writeInfoJson: false,
  outputTemplate: "",
  restrictFilenames: false,
  trimFilenames: "",
  proxy: "",
  socketTimeout: "",
  sourceAddress: "",
  forceIpv4: false,
  forceIpv6: false,
  username: "",
  password: "",
  videoPassword: "",
  cookiesFromBrowser: "",
  cookiesFile: "",
  sponsorblockRemove: "",
  sponsorblockMark: "",
  extraArgs: "",
};

/**
 * Translate settings into yt-dlp CLI arguments.
 * Format selection, playlist handling, audio extraction and the output
 * template are handled by the download pipeline itself, so they are not
 * emitted here.
 */
export function buildAdvancedArgs(s: AdvancedSettings): string[] {
  const args: string[] = [];
  const str = (flag: string, v: string) => {
    const t = v.trim();
    if (t) args.push(flag, t);
  };
  const bool = (flag: string, on: boolean) => {
    if (on) args.push(flag);
  };

  if (s.remuxVideo) args.push("--remux-video", s.remuxVideo);

  str("--playlist-items", s.playlistItems);
  str("-r", s.rateLimit);
  str("--retries", s.retries);
  str("--fragment-retries", s.fragmentRetries);
  str("-N", s.concurrentFragments);
  str("--buffer-size", s.bufferSize);
  bool("--force-overwrites", s.forceOverwrites);
  bool("--no-continue", s.noResume);
  bool("--no-part", s.noPart);
  bool("--keep-video", s.keepVideo);
  if (!s.fileMtime) args.push("--no-mtime");

  bool("--write-subs", s.writeSubs);
  bool("--write-auto-subs", s.writeAutoSubs);
  str("--sub-langs", s.subLangs);
  bool("--embed-subs", s.embedSubs);
  if (s.convertSubs) args.push("--convert-subs", s.convertSubs);

  bool("--embed-thumbnail", s.embedThumbnail);
  bool("--embed-metadata", s.embedMetadata);
  bool("--embed-chapters", s.embedChapters);
  bool("--write-description", s.writeDescription);
  bool("--write-thumbnail", s.writeThumbnail);
  bool("--write-info-json", s.writeInfoJson);

  bool("--restrict-filenames", s.restrictFilenames);
  str("--trim-filenames", s.trimFilenames);

  str("--proxy", s.proxy);
  str("--socket-timeout", s.socketTimeout);
  str("--source-address", s.sourceAddress);
  bool("-4", s.forceIpv4);
  bool("-6", s.forceIpv6);

  str("-u", s.username);
  str("-p", s.password);
  str("--video-password", s.videoPassword);
  str("--cookies-from-browser", s.cookiesFromBrowser);
  str("--cookies", s.cookiesFile);

  str("--sponsorblock-remove", s.sponsorblockRemove);
  str("--sponsorblock-mark", s.sponsorblockMark);

  args.push(...parseExtraArgs(s.extraArgs));
  return args;
}

/**
 * Flags that are unsafe or would fight with the app's own handling:
 * `--exec` runs arbitrary shell commands; output/paths options would let a
 * download land outside the downloads directory.
 */
const BLOCKED_FLAGS = new Set([
  "--exec",
  "-o",
  "--output",
  "-P",
  "--paths",
  "-a",
  "--batch-file",
]);

/** Tokenize the raw extra-args string (double/single quotes supported). */
export function parseExtraArgs(raw: string): string[] {
  const tokens = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const out: string[] = [];
  let skipNextValue = false;
  for (const tok of tokens) {
    const clean = tok.replace(/^["']|["']$/g, "");
    if (skipNextValue) {
      skipNextValue = false;
      continue;
    }
    const bare = clean.split("=")[0];
    if (BLOCKED_FLAGS.has(clean) || BLOCKED_FLAGS.has(bare)) {
      // "flag=value" forms carry their value inline; space forms need the
      // next token dropped too.
      if (!clean.includes("=")) skipNextValue = true;
      continue;
    }
    out.push(clean);
  }
  return out;
}

/** Number of settings that differ from their defaults (for a UI badge). */
export function countChanged(s: AdvancedSettings): number {
  let n = 0;
  const obj = s as unknown as Record<string, unknown>;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (obj[key] !== def) n++;
  }
  return n;
}

/** Coerce an untrusted JSON body into a validated AdvancedSettings object. */
export function parseAdvancedSettings(body: unknown): AdvancedSettings {
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = src[key];
    if (typeof def === "boolean") {
      out[key] = v === true;
    } else {
      out[key] = typeof v === "string" ? v.slice(0, 2000) : def;
    }
  }
  return out as unknown as AdvancedSettings;
}
