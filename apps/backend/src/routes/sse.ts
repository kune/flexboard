import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { verifyToken } from '../lib/auth.js'
import { canRead } from '../lib/permissions.js'
import { subscribe, unsubscribe } from '../lib/sse.js'
import { Board } from '../models/board.js'

export async function sseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/boards/:boardId/events', async (req, reply) => {
    const { boardId } = req.params as { boardId: string }
    const { token } = req.query as { token?: string }

    // EventSource can't send Authorization headers — token comes via query param
    if (!token) return reply.code(401).send({ error: 'token is required' })
    const payload = await verifyToken(token)
    if (!payload?.sub) return reply.code(401).send({ error: 'Invalid or expired token' })

    if (!mongoose.isValidObjectId(boardId)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(boardId)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canRead(board, payload.sub)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Take over the raw socket — Fastify must not touch this response further
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for this response
    })
    res.write(': connected\n\n')

    subscribe(boardId, res)

    // Keepalive comment every 25 s — prevents proxy/browser idle timeout
    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n') } catch { clearInterval(keepalive) }
    }, 25_000)

    req.raw.on('close', () => {
      clearInterval(keepalive)
      unsubscribe(boardId, res)
    })
  })
}
