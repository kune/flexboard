import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

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

// Health check — used by Docker Compose and load balancers
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
