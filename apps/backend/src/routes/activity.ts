import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { requireAuth, type AuthPayload } from '../lib/auth.js'
import { canRead } from '../lib/permissions.js'
import { Board } from '../models/board.js'
import { Card } from '../models/card.js'
import { ActivityLog } from '../models/activitylog.js'

type AuthRequest = { user: AuthPayload }

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/boards/:boardId/cards/:cardId/activity',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, cardId } = req.params as { boardId: string; cardId: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(cardId)) {
        return reply.code(404).send({ error: 'Not found' })
      }
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canRead(board, sub)) {
        return reply.code(403).send({ error: 'Forbidden' })
      }
      const card = await Card.findOne({ _id: cardId, boardId })
      if (!card) return reply.code(404).send({ error: 'Not found' })
      return ActivityLog.find({ cardId }).sort({ createdAt: -1 }).limit(100)
    },
  )
}
