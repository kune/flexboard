import { createRequire } from 'module'
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

function computeVersion(raw: string): string {
  const m = raw.match(/^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)(-dirty)?$/)
  if (!m) return raw.replace(/^v/, '')
  const [, major, minor, patch, distance, hash, dirty] = m
  const base = distance === '0'
    ? `${major}.${minor}.${patch}`
    : `${major}.${minor}.${parseInt(patch) + 1}-dev+${hash.slice(0, 7)}`
  return dirty ? `${base}-dirty` : base
}

function getVersion(): string {
  // In Docker builds the CI runner computes the version and passes it as
  // APP_VERSION_RAW so we never run git describe inside the container
  // (build steps that run beforehand can dirty the working tree).
  const envRaw = process.env.APP_VERSION_RAW?.trim()
  if (envRaw) return computeVersion(envRaw)
  try {
    const raw = execSync('git describe --tags --long --dirty --match "v*"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return computeVersion(raw)
  } catch {}
  const _require = createRequire(import.meta.url)
  return (_require('./package.json') as { version: string }).version
}

const version = getVersion()

export default defineConfig({
  // Load .env from the monorepo root so VITE_* vars are shared
  envDir: resolve(__dirname, '../../'),
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true, // bind to 0.0.0.0 so Docker nginx can reach it via host.docker.internal
    proxy: {
      // Proxy API and SSE requests to the backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/dex': {
        target: 'http://localhost:5556',
        changeOrigin: true,
      },
    },
  },
})
