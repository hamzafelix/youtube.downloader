# syntax=docker/dockerfile:1

# ── Stage 1: install npm dependencies ────────────────────────────────────────
# Always npm ci inside Linux so native bindings (turbopack/oxide, etc.) match
# the container's platform, never the host machine's.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build the Next.js app ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# ffmpeg   → merging video+audio streams (1080p+) and MP3 extraction
# python3  → yt-dlp's runtime. Installed via pip because the standalone
#            release binaries are glibc-based and won't run on Alpine (musl).
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    YTDLP_PATH=/usr/bin/yt-dlp

RUN apk add --no-cache ffmpeg python3 py3-pip \
 && pip3 install --break-system-packages --no-cache-dir yt-dlp

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output: self-contained server.js plus only the node_modules it needs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
