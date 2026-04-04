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
import { sseRoutes } from '@/routes/sse.js'

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
await sseRoutes(app)

export default app
