import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { requireAuth, type AuthPayload } from '../lib/auth.js'
import { canRead, canWrite } from '../lib/permissions.js'
import { Board } from '../models/board.js'
import { Card } from '../models/card.js'
import { ActivityLog } from '../models/activitylog.js'
import { broadcast } from '../lib/sse.js'

type AuthRequest = { user: AuthPayload }

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/boards/:boardId/cards', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId } = req.params as { boardId: string }
    if (!mongoose.isValidObjectId(boardId)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(boardId)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canRead(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    return Card.find({ boardId }).sort({ position: 1 })
  })

  app.post('/api/v1/boards/:boardId/cards', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId } = req.params as { boardId: string }
    if (!mongoose.isValidObjectId(boardId)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(boardId)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    const { columnId, type, title, description, position, attributes } = req.body as {
      columnId: string
      type: string
      title: string
      description?: string
      position?: number
      attributes?: Record<string, unknown>
    }
    if (!title?.trim()) return reply.code(400).send({ error: 'title is required' })
    if (!columnId || !mongoose.isValidObjectId(columnId))
      return reply.code(400).send({ error: 'valid columnId is required' })
    if (!type) return reply.code(400).send({ error: 'type is required' })
    const lastCard = await Card.findOne({ columnId }).sort({ position: -1 })
    const pos = position ?? (lastCard ? lastCard.position + 1 : 0)
    const card = await Card.create({
      boardId,
      columnId,
      type,
      title: title.trim(),
      description,
      position: pos,
      createdBy: sub,
      attributes: attributes ?? {},
    })
    await ActivityLog.create({
      cardId: card._id,
      boardId: new mongoose.Types.ObjectId(boardId),
      actorId: sub,
      event: 'card.created',
      payload: { type, title: card.title },
    })
    broadcast(boardId, 'card.created', { boardId, cardId: card.id, columnId })
    return reply.code(201).send(card)
  })

  app.get(
    '/api/v1/boards/:boardId/cards/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, id } = req.params as { boardId: string; id: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(id))
        return reply.code(404).send({ error: 'Not found' })
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canRead(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
      const card = await Card.findOne({ _id: id, boardId })
      if (!card) return reply.code(404).send({ error: 'Not found' })
      return card
    },
  )

  app.patch(
    '/api/v1/boards/:boardId/cards/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, id } = req.params as { boardId: string; id: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(id))
        return reply.code(404).send({ error: 'Not found' })
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
      const card = await Card.findOne({ _id: id, boardId })
      if (!card) return reply.code(404).send({ error: 'Not found' })
      const { columnId, title, description, position, attributes } = req.body as {
        columnId?: string
        title?: string
        description?: string
        position?: number
        attributes?: Record<string, unknown>
      }
      const changedFields: string[] = []
      const movedToColumn = columnId !== undefined && mongoose.isValidObjectId(columnId) && card.columnId.toString() !== columnId
      if (columnId !== undefined && mongoose.isValidObjectId(columnId)) { card.columnId = new mongoose.Types.ObjectId(columnId); changedFields.push('columnId') }
      if (title !== undefined) { card.title = title.trim(); changedFields.push('title') }
      if (description !== undefined) { card.description = description; changedFields.push('description') }
      if (position !== undefined) { card.position = position }
      if (attributes !== undefined) { card.attributes = attributes; changedFields.push('attributes') }
      await card.save()
      if (movedToColumn) {
        await ActivityLog.create({
          cardId: card._id,
          boardId: new mongoose.Types.ObjectId(boardId),
          actorId: sub,
          event: 'card.moved',
          payload: { toColumnId: columnId },
        })
        broadcast(boardId, 'card.moved', { boardId, cardId: card.id, toColumnId: columnId })
      } else if (changedFields.some((f) => f !== 'columnId')) {
        const fields = changedFields.filter((f) => f !== 'columnId')
        await ActivityLog.create({
          cardId: card._id,
          boardId: new mongoose.Types.ObjectId(boardId),
          actorId: sub,
          event: 'card.updated',
          payload: { fields },
        })
        broadcast(boardId, 'card.updated', { boardId, cardId: card.id, fields })
      }
      return card
    },
  )

  app.delete(
    '/api/v1/boards/:boardId/cards/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, id } = req.params as { boardId: string; id: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(id))
        return reply.code(404).send({ error: 'Not found' })
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
      const card = await Card.findOne({ _id: id, boardId })
      if (!card) return reply.code(404).send({ error: 'Not found' })
      await card.deleteOne()
      broadcast(boardId, 'card.deleted', { boardId, cardId: id })
      return reply.code(204).send()
    },
  )
}
