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

# Copy source + git history so we can compute the version
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./
COPY .git .git
COPY scripts/write-version.cjs ./scripts/write-version.cjs

# Build shared package first, then backend
RUN pnpm --filter @flexboard/shared build
RUN pnpm --filter @flexboard/backend build

# Write the computed version to dist/VERSION (copied to the runtime container below)
RUN node scripts/write-version.cjs

# ── Stage 2: Runtime ─────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy only what's needed to run.
# node_modules is copied first; then we replace the pnpm workspace symlink
# for @flexboard/shared with the actual built output.
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
RUN rm -rf ./node_modules/@flexboard/shared
COPY --from=builder /app/packages/shared/package.json ./node_modules/@flexboard/shared/package.json
COPY --from=builder /app/packages/shared/dist ./node_modules/@flexboard/shared/dist

# Copy card type config (read by seed service on startup)
COPY config/card-types.yaml ./config/card-types.yaml

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/index.js"]
