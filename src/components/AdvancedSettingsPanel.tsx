"use client";

import { AdvancedSettings as Settings } from "@/lib/settings";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-600 focus:border-red-500";
const labelCls = "text-xs font-medium text-zinc-400";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-zinc-600">{hint}</span>}
    </div>
  );
}

function Text({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </Field>
  );
}

function Select({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-red-600"
      />
      <span>
        {label}
        {hint && <span className="ml-1 text-[11px] text-zinc-600">{hint}</span>}
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-zinc-200">
        {title}
      </summary>
      <div className="flex flex-col gap-3 border-t border-zinc-800 px-3 py-3">
        {children}
      </div>
    </details>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

export default function AdvancedSettingsPanel({ settings: s, onChange }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...s, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      {/* Format */}
      <Group title="🎛 Format & container">
        <Text
          label="Custom format selector (-f)"
          hint="Overrides the quality preset. e.g. bestvideo[height<=2160]+bestaudio/best"
          value={s.format}
          onChange={(v) => set("format", v)}
        />
        <Select
          label="Remux video to (--remux-video)"
          hint="Changes the container without re-encoding (needs ffmpeg)"
          value={s.remuxVideo}
          onChange={(v) => set("remuxVideo", v)}
          options={[
            { value: "", label: "Leave as-is" },
            { value: "mp4", label: "mp4" },
            { value: "mkv", label: "mkv" },
            { value: "webm", label: "webm" },
            { value: "avi", label: "avi" },
            { value: "mov", label: "mov" },
            { value: "flv", label: "flv" },
          ]}
        />
      </Group>

      {/* Audio */}
      <Group title="🎵 Audio extraction">
        <p className="text-[11px] text-zinc-600">
          Applies when the quality preset is “Audio only”.
        </p>
        <Row>
          <Select
            label="Audio format (-x --audio-format)"
            value={s.audioFormat}
            onChange={(v) => set("audioFormat", v)}
            options={[
              { value: "mp3", label: "mp3" },
              { value: "m4a", label: "m4a" },
              { value: "opus", label: "opus" },
              { value: "flac", label: "flac" },
              { value: "wav", label: "wav" },
              { value: "aac", label: "aac" },
              { value: "vorbis", label: "vorbis" },
              { value: "best", label: "best (keep source)" },
            ]}
          />
          <Select
            label="Audio quality (--audio-quality)"
            hint="0 = best, 10 = worst (VBR)"
            value={s.audioQuality}
            onChange={(v) => set("audioQuality", v)}
            options={["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map(
              (q) => ({ value: q, label: q })
            )}
          />
        </Row>
      </Group>

      {/* Download behaviour */}
      <Group title="⬇ Download behaviour">
        <Toggle
          label="Download whole playlists"
          hint="--yes-playlist"
          checked={s.downloadPlaylist}
          onChange={(v) => set("downloadPlaylist", v)}
        />
        <Text
          label="Playlist items (--playlist-items)"
          hint='e.g. "1:5,8" or "1-3,7"'
          value={s.playlistItems}
          onChange={(v) => set("playlistItems", v)}
        />
        <Row>
          <Text
            label="Rate limit (-r)"
            hint="e.g. 500K or 4.2M"
            value={s.rateLimit}
            onChange={(v) => set("rateLimit", v)}
          />
          <Text
            label="Buffer size (--buffer-size)"
            hint="e.g. 16M"
            value={s.bufferSize}
            onChange={(v) => set("bufferSize", v)}
          />
        </Row>
        <Row>
          <Text
            label="Retries (--retries)"
            hint="number or infinite"
            value={s.retries}
            onChange={(v) => set("retries", v)}
          />
          <Text
            label="Fragment retries (--fragment-retries)"
            hint="DASH/HLS fragments"
            value={s.fragmentRetries}
            onChange={(v) => set("fragmentRetries", v)}
          />
        </Row>
        <Text
          label="Concurrent fragment downloads (-N)"
          hint="Speeds up DASH/HLS downloads"
          value={s.concurrentFragments}
          onChange={(v) => set("concurrentFragments", v)}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle
            label="Force overwrite"
            hint="--force-overwrites"
            checked={s.forceOverwrites}
            onChange={(v) => set("forceOverwrites", v)}
          />
          <Toggle
            label="No resume"
            hint="--no-continue"
            checked={s.noResume}
            onChange={(v) => set("noResume", v)}
          />
          <Toggle
            label="No .part files"
            hint="--no-part"
            checked={s.noPart}
            onChange={(v) => set("noPart", v)}
          />
          <Toggle
            label="Keep pre-merge video"
            hint="--keep-video"
            checked={s.keepVideo}
            onChange={(v) => set("keepVideo", v)}
          />
          <Toggle
            label="Use server file date"
            hint="off = --no-mtime"
            checked={s.fileMtime}
            onChange={(v) => set("fileMtime", v)}
          />
        </div>
      </Group>

      {/* Subtitles */}
      <Group title="💬 Subtitles">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle
            label="Write subtitles"
            hint="--write-subs"
            checked={s.writeSubs}
            onChange={(v) => set("writeSubs", v)}
          />
          <Toggle
            label="Write auto-generated subs"
            hint="--write-auto-subs"
            checked={s.writeAutoSubs}
            onChange={(v) => set("writeAutoSubs", v)}
          />
          <Toggle
            label="Embed subtitles"
            hint="--embed-subs"
            checked={s.embedSubs}
            onChange={(v) => set("embedSubs", v)}
          />
        </div>
        <Row>
          <Text
            label="Subtitle languages (--sub-langs)"
            hint='e.g. "en,ja" or "all"'
            value={s.subLangs}
            onChange={(v) => set("subLangs", v)}
          />
          <Select
            label="Convert subs to (--convert-subs)"
            value={s.convertSubs}
            onChange={(v) => set("convertSubs", v)}
            options={[
              { value: "", label: "Keep original" },
              { value: "srt", label: "srt" },
              { value: "vtt", label: "vtt" },
              { value: "ass", label: "ass" },
              { value: "lrc", label: "lrc" },
            ]}
          />
        </Row>
      </Group>

      {/* Metadata & thumbnails */}
      <Group title="🏷 Metadata, thumbnails & chapters">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle
            label="Embed thumbnail"
            hint="--embed-thumbnail"
            checked={s.embedThumbnail}
            onChange={(v) => set("embedThumbnail", v)}
          />
          <Toggle
            label="Embed metadata"
            hint="--embed-metadata"
            checked={s.embedMetadata}
            onChange={(v) => set("embedMetadata", v)}
          />
          <Toggle
            label="Embed chapters"
            hint="--embed-chapters"
            checked={s.embedChapters}
            onChange={(v) => set("embedChapters", v)}
          />
          <Toggle
            label="Write .description file"
            hint="--write-description"
            checked={s.writeDescription}
            onChange={(v) => set("writeDescription", v)}
          />
          <Toggle
            label="Write thumbnail image"
            hint="--write-thumbnail"
            checked={s.writeThumbnail}
            onChange={(v) => set("writeThumbnail", v)}
          />
          <Toggle
            label="Write .info.json"
            hint="--write-info-json"
            checked={s.writeInfoJson}
            onChange={(v) => set("writeInfoJson", v)}
          />
        </div>
      </Group>

      {/* Output */}
      <Group title="📁 Output & filenames">
        <Text
          label="Filename template (-o)"
          hint='Relative to downloads/. e.g. "%(uploader)s/%(title)s.%(ext)s"'
          value={s.outputTemplate}
          onChange={(v) => set("outputTemplate", v)}
        />
        <Row>
          <Toggle
            label="Restrict filenames to ASCII"
            hint="--restrict-filenames"
            checked={s.restrictFilenames}
            onChange={(v) => set("restrictFilenames", v)}
          />
          <Text
            label="Trim filenames (--trim-filenames)"
            hint="max characters"
            value={s.trimFilenames}
            onChange={(v) => set("trimFilenames", v)}
          />
        </Row>
      </Group>

      {/* Network */}
      <Group title="🌐 Network">
        <Text
          label="Proxy (--proxy)"
          hint="e.g. socks5://127.0.0.1:1080"
          value={s.proxy}
          onChange={(v) => set("proxy", v)}
        />
        <Row>
          <Text
            label="Socket timeout (--socket-timeout)"
            hint="seconds"
            value={s.socketTimeout}
            onChange={(v) => set("socketTimeout", v)}
          />
          <Text
            label="Source address (--source-address)"
            hint="client-side IP to bind"
            value={s.sourceAddress}
            onChange={(v) => set("sourceAddress", v)}
          />
        </Row>
        <div className="flex gap-6">
          <Toggle
            label="Force IPv4 (-4)"
            checked={s.forceIpv4}
            onChange={(v) => set("forceIpv4", v)}
          />
          <Toggle
            label="Force IPv6 (-6)"
            checked={s.forceIpv6}
            onChange={(v) => set("forceIpv6", v)}
          />
        </div>
      </Group>

      {/* Authentication */}
      <Group title="🔐 Authentication & cookies">
        <Row>
          <Text
            label="Username (-u)"
            value={s.username}
            onChange={(v) => set("username", v)}
          />
          <Text
            label="Password (-p)"
            value={s.password}
            onChange={(v) => set("password", v)}
          />
        </Row>
        <Text
          label="Video password (--video-password)"
          hint="for protected videos"
          value={s.videoPassword}
          onChange={(v) => set("videoPassword", v)}
        />
        <Row>
          <Select
            label="Cookies from browser (--cookies-from-browser)"
            value={s.cookiesFromBrowser}
            onChange={(v) => set("cookiesFromBrowser", v)}
            options={[
              { value: "", label: "Don't use browser cookies" },
              { value: "chrome", label: "chrome" },
              { value: "firefox", label: "firefox" },
              { value: "edge", label: "edge" },
              { value: "brave", label: "brave" },
              { value: "vivaldi", label: "vivaldi" },
              { value: "safari", label: "safari" },
            ]}
          />
          <Text
            label="Cookies file (--cookies)"
            hint="path to cookies.txt (Netscape format)"
            value={s.cookiesFile}
            onChange={(v) => set("cookiesFile", v)}
          />
        </Row>
      </Group>

      {/* SponsorBlock */}
      <Group title="✂ SponsorBlock">
        <Text
          label="Remove categories (--sponsorblock-remove)"
          hint='e.g. "sponsor,selfpromo,interaction,preview"'
          value={s.sponsorblockRemove}
          onChange={(v) => set("sponsorblockRemove", v)}
        />
        <Text
          label="Mark as chapters (--sponsorblock-mark)"
          value={s.sponsorblockMark}
          onChange={(v) => set("sponsorblockMark", v)}
        />
      </Group>

      {/* Raw args */}
      <Group title="🧩 Raw extra arguments">
        <Field
          label="Extra yt-dlp arguments"
          hint="Whitespace-separated; quotes supported. Unsafe flags (--exec, --output, --paths, --batch-file) are stripped."
        >
          <textarea
            rows={3}
            value={s.extraArgs}
            onChange={(e) => set("extraArgs", e.target.value)}
            placeholder='--extractor-args "youtube:player_client=android" --no-check-certificates'
            className={`${inputCls} resize-y font-mono text-xs`}
          />
        </Field>
      </Group>
    </div>
  );
}
