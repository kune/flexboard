import { createRequire } from 'module'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { requireAuth, type AuthPayload } from '@/lib/auth.js'
import { connectDb } from '@/lib/db.js'
import { seedCardTypes } from '@/lib/seed.js'
import { boardRoutes } from '@/routes/boards.js'
import { cardRoutes } from '@/routes/cards.js'
import { cardTypeRoutes } from '@/routes/cardtypes.js'
import { commentRoutes } from '@/routes/comments.js'
import { activityRoutes } from '@/routes/activity.js'
import { memberRoutes } from '@/routes/members.js'
import { sseRoutes } from '@/routes/sse.js'

function computeVersion(raw: string): string {
  const m = raw.match(/^v(\d+)\.(\d+)\.(\d+)-(\d+)-g([0-9a-f]+)$/)
  if (!m) return raw.replace(/^v/, '')
  const [, major, minor, patch, distance, hash] = m
  if (distance === '0') return `${major}.${minor}.${patch}`
  return `${major}.${minor}.${parseInt(patch) + 1}-dev+${hash.slice(0, 7)}`
}

function getVersion(): string {
  // 1. VERSION file written by the Docker builder stage (production container has no git)
  try {
    const __dir = dirname(fileURLToPath(import.meta.url))
    const v = readFileSync(resolve(__dir, 'VERSION'), 'utf-8').trim()
    if (v) return v
  } catch {}
  // 2. git describe — works in local development (tsx watch)
  try {
    const raw = execSync('git describe --tags --long --match "v*"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return computeVersion(raw)
  } catch {}
  // 3. Fallback to package.json
  const _require = createRequire(import.meta.url)
  return (_require('../package.json') as { version: string }).version
}

const backendVersion = getVersion()

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
})

await app.register(helmet)

// Connect to MongoDB and seed reference data
await connectDb()
await seedCardTypes()

// Health check — unauthenticated, used by Docker Compose
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Version — unauthenticated
app.get('/api/v1/version', async () => ({ version: backendVersion }))

// Auth smoke-test
app.get(
  '/api/v1/me',
  { preHandler: requireAuth },
  async (request) => {
    const user = (request as typeof request & { user: AuthPayload }).user
    return { sub: user.sub, email: user.email, name: user.name }
  },
)

await boardRoutes(app)
await cardRoutes(app)
await cardTypeRoutes(app)
await commentRoutes(app)
await activityRoutes(app)
await memberRoutes(app)
await sseRoutes(app)

export default app
