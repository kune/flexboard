# ── Stage 1: Build ───────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

RUN npm install -g pnpm && apk add --no-cache git

WORKDIR /app

# Copy ALL workspace manifests — pnpm needs the full workspace graph to
# resolve symlinks correctly, even when building only one package.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source + git history (vite.config.ts calls git describe to compute the version)
COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./
COPY .git .git

# Build shared package first, then frontend
RUN pnpm --filter @flexboard/shared build
RUN pnpm --filter @flexboard/frontend build

# ── Stage 2: Serve ───────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1/health || exit 1
