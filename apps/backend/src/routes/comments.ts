import type { FastifyInstance, FastifyReply } from 'fastify'
import mongoose from 'mongoose'
import { requireAuth, type AuthPayload } from '../lib/auth.js'
import { Board } from '../models/board.js'
import { Card } from '../models/card.js'
import { Comment } from '../models/comment.js'
import { ActivityLog } from '../models/activitylog.js'
import { broadcast } from '../lib/sse.js'

type AuthRequest = { user: AuthPayload }

async function assertAccess(
  boardId: string,
  cardId: string,
  sub: string,
  reply: FastifyReply,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(boardId) || !mongoose.isValidObjectId(cardId)) {
    reply.code(404).send({ error: 'Not found' }); return false
  }
  const board = await Board.findById(boardId)
  if (!board) { reply.code(404).send({ error: 'Not found' }); return false }
  if (board.ownerId !== sub && !board.memberIds.includes(sub)) {
    reply.code(403).send({ error: 'Forbidden' }); return false
  }
  const card = await Card.findOne({ _id: cardId, boardId })
  if (!card) { reply.code(404).send({ error: 'Not found' }); return false }
  return true
}

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  const base = '/api/v1/boards/:boardId/cards/:cardId/comments'

  // ── GET list ───────────────────────────────────────────────
  app.get(base, { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId, cardId } = req.params as { boardId: string; cardId: string }
    if (!await assertAccess(boardId, cardId, sub, reply)) return
    return Comment.find({ cardId }).sort({ createdAt: 1 })
  })

  // ── POST create ────────────────────────────────────────────
  app.post(base, { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId, cardId } = req.params as { boardId: string; cardId: string }
    if (!await assertAccess(boardId, cardId, sub, reply)) return
    const { body } = req.body as { body: string }
    if (!body?.trim()) return reply.code(400).send({ error: 'body is required' })
    const comment = await Comment.create({
      cardId,
      boardId,
      authorId: sub,
      body: body.trim(),
    })
    await ActivityLog.create({
      cardId,
      boardId,
      actorId: sub,
      event: 'comment.added',
      payload: { commentId: comment.id },
    })
    broadcast(boardId, 'comment.added', { boardId, cardId })
    return reply.code(201).send(comment)
  })

  // ── PATCH update ───────────────────────────────────────────
  app.patch(`${base}/:id`, { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId, cardId, id } = req.params as { boardId: string; cardId: string; id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    if (!await assertAccess(boardId, cardId, sub, reply)) return
    const comment = await Comment.findOne({ _id: id, cardId })
    if (!comment) return reply.code(404).send({ error: 'Not found' })
    if (comment.authorId !== sub) return reply.code(403).send({ error: 'Forbidden' })
    const { body } = req.body as { body?: string }
    if (body !== undefined) {
      if (!body.trim()) return reply.code(400).send({ error: 'body cannot be empty' })
      comment.body = body.trim()
    }
    await comment.save()
    return comment
  })

  // ── DELETE ─────────────────────────────────────────────────
  app.delete(`${base}/:id`, { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { boardId, cardId, id } = req.params as { boardId: string; cardId: string; id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    if (!await assertAccess(boardId, cardId, sub, reply)) return
    const comment = await Comment.findOne({ _id: id, cardId })
    if (!comment) return reply.code(404).send({ error: 'Not found' })
    if (comment.authorId !== sub) return reply.code(403).send({ error: 'Forbidden' })
    await comment.deleteOne()
    return reply.code(204).send()
  })
}
