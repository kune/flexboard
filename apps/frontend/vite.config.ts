import { createRequire } from 'module'
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

function computeVersion(raw: string): string {
  const m = raw.match(/^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)$/)
  if (!m) return raw.replace(/^v/, '')
  const [, major, minor, patch, distance, hash] = m
  if (distance === '0') return `${major}.${minor}.${patch}`
  return `${major}.${minor}.${parseInt(patch) + 1}-dev+${hash.slice(0, 7)}`
}

function getVersion(): string {
  try {
    const raw = execSync('git describe --tags --long --match "v*"', {
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
