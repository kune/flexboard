# ── Stage 1: Build ───────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

# Passed from the CI runner so git describe never runs inside the container
# (build steps can dirty the working tree, producing a false -dirty suffix).
ARG APP_VERSION_RAW
ENV APP_VERSION_RAW=$APP_VERSION_RAW

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
# OpenResty = nginx + LuaJIT, needed to rewrite Rauthy's __Host- Secure cookies
# for HTTP deployments (Rauthy 0.35+ always sets Secure cookies unconditionally).
FROM openresty/openresty:alpine

# envsubst (for config.js injection at startup)
RUN apk add --no-cache gettext

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# Template is expanded at container startup: ${OIDC_ISSUER} → actual issuer URL
COPY docker/config.js.template /etc/nginx/config.js.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1/ || exit 1

# Generate /config.js from the template, then start OpenResty/nginx.
CMD ["/bin/sh", "-c", \
  "envsubst '${OIDC_ISSUER}' < /etc/nginx/config.js.template > /usr/share/nginx/html/config.js && exec nginx -g 'daemon off;'"]
