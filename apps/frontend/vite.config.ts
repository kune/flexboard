import { createRequire } from 'module'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const _require = createRequire(import.meta.url)
const { version } = _require('./package.json') as { version: string }

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
