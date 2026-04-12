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

      // Capture old values before mutation (for activity log detail)
      const oldTitle = card.title
      const fromColumnId = card.columnId.toString()
      const oldAttrs: Record<string, unknown> = card.attributes instanceof Map
        ? Object.fromEntries(card.attributes as Map<string, unknown>)
        : { ...(card.attributes ?? {}) as Record<string, unknown> }

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
          payload: { fromColumnId, toColumnId: columnId },
        })
        broadcast(boardId, 'card.moved', { boardId, cardId: card.id, toColumnId: columnId })
      } else if (changedFields.some((f) => f !== 'columnId')) {
        const fields = changedFields.filter((f) => f !== 'columnId')
        const changes: Record<string, unknown> = {}
        if (fields.includes('title')) {
          changes.title = { from: oldTitle, to: card.title }
        }
        if (fields.includes('attributes') && attributes !== undefined) {
          const newAttrs = attributes as Record<string, unknown>
          const attrChanges: Record<string, { from: unknown; to: unknown }> = {}
          const allKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)])
          for (const key of allKeys) {
            const ov = oldAttrs[key] ?? null
            const nv = newAttrs[key] ?? null
            if (JSON.stringify(ov) !== JSON.stringify(nv)) {
              attrChanges[key] = { from: ov, to: nv }
            }
          }
          if (Object.keys(attrChanges).length > 0) changes.attributes = attrChanges
        }
        await ActivityLog.create({
          cardId: card._id,
          boardId: new mongoose.Types.ObjectId(boardId),
          actorId: sub,
          event: 'card.updated',
          payload: { fields, ...(Object.keys(changes).length > 0 ? { changes } : {}) },
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
