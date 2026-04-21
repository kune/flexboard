import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { requireAuth, type AuthPayload } from '../lib/auth.js'
import { canRead, canWrite, isOwner } from '../lib/permissions.js'
import { Board } from '../models/board.js'
import { Column } from '../models/board.js'
import { Card } from '../models/card.js'
import { broadcast } from '../lib/sse.js'

type AuthRequest = { user: AuthPayload }

export async function boardRoutes(app: FastifyInstance): Promise<void> {
  // ── Boards ────────────────────────────────────────────────────────────────

  app.get('/api/v1/boards', { preHandler: requireAuth }, async (req) => {
    const { sub } = (req as typeof req & AuthRequest).user
    return Board.find({ 'members.userId': sub }).sort({ createdAt: -1 })
  })

  app.post('/api/v1/boards', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { name, description } = req.body as { name: string; description?: string }
    if (!name?.trim()) return reply.code(400).send({ error: 'name is required' })
    const board = await Board.create({
      name: name.trim(),
      description,
      members: [{ userId: sub, role: 'owner' }],
    })
    // Seed three default columns so the "Add card" button is immediately usable.
    await Column.insertMany([
      { boardId: board._id, name: 'To Do',       position: 0 },
      { boardId: board._id, name: 'In Progress',  position: 1 },
      { boardId: board._id, name: 'Done',         position: 2 },
    ])
    return reply.code(201).send(board)
  })

  app.get('/api/v1/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id } = req.params as { id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canRead(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    return board
  })

  app.patch('/api/v1/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id } = req.params as { id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!isOwner(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    const { name, description } = req.body as { name?: string; description?: string }
    if (name !== undefined) board.name = name.trim()
    if (description !== undefined) board.description = description
    await board.save()
    return board
  })

  app.delete('/api/v1/boards/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id } = req.params as { id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!isOwner(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    const oid = new mongoose.Types.ObjectId(id)
    await Promise.all([
      board.deleteOne(),
      Column.deleteMany({ boardId: oid }),
      Card.deleteMany({ boardId: oid }),
    ])
    return reply.code(204).send()
  })

  // ── Columns ───────────────────────────────────────────────────────────────

  app.get('/api/v1/boards/:boardId/columns', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId } = req.params as { boardId: string }
    if (!mongoose.isValidObjectId(boardId)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(boardId)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canRead(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    return Column.find({ boardId }).sort({ position: 1 })
  })

  app.post('/api/v1/boards/:boardId/columns', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId } = req.params as { boardId: string }
    if (!mongoose.isValidObjectId(boardId)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(boardId)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
    const { name, position } = req.body as { name: string; position?: number }
    if (!name?.trim()) return reply.code(400).send({ error: 'name is required' })
    const lastCol = await Column.findOne({ boardId }).sort({ position: -1 })
    const pos = position ?? (lastCol ? lastCol.position + 1 : 0)
    const col = await Column.create({ boardId, name: name.trim(), position: pos })
    broadcast(boardId, 'column.created', { boardId, columnId: col.id })
    return reply.code(201).send(col)
  })

  app.patch(
    '/api/v1/boards/:boardId/columns/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, id } = req.params as { boardId: string; id: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(id))
        return reply.code(404).send({ error: 'Not found' })
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
      const col = await Column.findOne({ _id: id, boardId })
      if (!col) return reply.code(404).send({ error: 'Not found' })
      const { name, position } = req.body as { name?: string; position?: number }
      if (name !== undefined) col.name = name.trim()
      if (position !== undefined) col.position = position
      await col.save()
      broadcast(boardId, 'column.updated', { boardId, columnId: id })
      return col
    },
  )

  app.delete(
    '/api/v1/boards/:boardId/columns/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sub } = (req as typeof req & AuthRequest).user
      const { boardId, id } = req.params as { boardId: string; id: string }
      if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(id))
        return reply.code(404).send({ error: 'Not found' })
      const board = await Board.findById(boardId)
      if (!board) return reply.code(404).send({ error: 'Not found' })
      if (!canWrite(board, sub)) return reply.code(403).send({ error: 'Forbidden' })
      const col = await Column.findOne({ _id: id, boardId })
      if (!col) return reply.code(404).send({ error: 'Not found' })
      await Promise.all([col.deleteOne(), Card.deleteMany({ columnId: id })])
      broadcast(boardId, 'column.deleted', { boardId, columnId: id })
      return reply.code(204).send()
    },
  )
}
