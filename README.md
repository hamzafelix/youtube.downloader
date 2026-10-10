# ytbdwnld 🎬

Local web app to download videos via **yt-dlp** with live progress, built with Next.js 16 (App Router) + Tailwind 4.

## Requirements

- **yt-dlp** — expected at `C:\Users\hamza\AppData\Local\hermes\hermes-agent\venv\Scripts\yt-dlp.exe` (override with the `YTDLP_PATH` env var)
- **ffmpeg** — on PATH (needed for 1080p+ merging and MP3 extraction)
- **Node.js** — also used by yt-dlp as its JS runtime for YouTube extraction

## Run

```bash
npm install   # first time only
npm run dev   # http://localhost:3000
# or production:
npm run build && npm start
```

## What it does

1. Paste a video URL → `POST /api/info` returns title, channel, duration, thumbnail (via `yt-dlp -J --flat-playlist`)
2. Pick quality (Best / 1080p / 720p / 480p / MP3) → `POST /api/download` spawns yt-dlp as a background job
3. Live progress streams over SSE at `GET /api/progress/[id]` — percent, speed, ETA
4. When done: file is saved to `downloads/` **and** downloadable from the browser via `GET /api/file/[id]`
5. Cancel anytime via `POST /api/cancel/[id]`

## Notes

- Downloads land in `ytbdwnld/downloads/` (gitignored)
- Playlist URLs download only the first video (`--no-playlist`)
- Jobs live in memory — restarting the server clears the progress history (files stay on disk)
