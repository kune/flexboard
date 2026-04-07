import type { FastifyInstance } from 'fastify'
import mongoose from 'mongoose'
import { requireAuth, type AuthPayload } from '../lib/auth.js'
import { canRead, isOwner, getMemberRole } from '../lib/permissions.js'
import { Board } from '../models/board.js'
import { User } from '../models/user.js'
import type { UserRole } from '@flexboard/shared'

type AuthRequest = { user: AuthPayload }

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  // ── User search (used by invite UI) ───────────────────────────────────────

  // Returns users matching an email prefix — only users who have logged in at
  // least once are in the directory.
  app.get('/api/v1/users', { preHandler: requireAuth }, async (req) => {
    const { email } = req.query as { email?: string }
    if (!email?.trim()) return []
    const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return User.find({ email: { $regex: `^${escaped}`, $options: 'i' } })
      .select('sub email name')
      .limit(10)
  })

  // ── Board members ─────────────────────────────────────────────────────────

  // GET — list members with enriched profile (email, name)
  app.get('/api/v1/boards/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id } = req.params as { id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!canRead(board, sub)) return reply.code(403).send({ error: 'Forbidden' })

    const userIds = board.members.map((m) => m.userId)
    const users = await User.find({ sub: { $in: userIds } }).select('sub email name')
    const userMap = new Map(users.map((u) => [u.sub, u]))

    return board.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      email: userMap.get(m.userId)?.email ?? m.userId,
      name: userMap.get(m.userId)?.name ?? m.userId,
    }))
  })

  // POST — invite a user by email (owner only)
  app.post('/api/v1/boards/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id } = req.params as { id: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!isOwner(board, sub)) return reply.code(403).send({ error: 'Forbidden' })

    const { email, role } = req.body as { email: string; role: UserRole }
    if (!email?.trim()) return reply.code(400).send({ error: 'email is required' })
    if (!['editor', 'viewer'].includes(role))
      return reply.code(400).send({ error: 'role must be editor or viewer' })

    const invitee = await User.findOne({ email: email.trim().toLowerCase() })
    if (!invitee) {
      return reply.code(404).send({
        error: 'User not found. They must sign in to Flexboard at least once before they can be invited.',
      })
    }
    if (getMemberRole(board, invitee.sub) !== null)
      return reply.code(409).send({ error: 'User is already a member of this board' })

    board.members.push({ userId: invitee.sub, role })
    await board.save()
    return reply.code(201).send({ userId: invitee.sub, role, email: invitee.email, name: invitee.name })
  })

  // PATCH — change a member's role (owner only; cannot demote last owner)
  app.patch('/api/v1/boards/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id, userId } = req.params as { id: string; userId: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!isOwner(board, sub)) return reply.code(403).send({ error: 'Forbidden' })

    const { role } = req.body as { role: UserRole }
    if (!['owner', 'editor', 'viewer'].includes(role))
      return reply.code(400).send({ error: 'role must be owner, editor, or viewer' })

    const member = board.members.find((m) => m.userId === userId)
    if (!member) return reply.code(404).send({ error: 'Member not found' })

    // Guard: cannot remove the last owner
    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = board.members.filter((m) => m.role === 'owner').length
      if (ownerCount === 1)
        return reply.code(400).send({ error: 'Board must have at least one owner' })
    }

    member.role = role
    await board.save()
    return { userId, role }
  })

  // DELETE — remove a member (owner only; cannot remove last owner)
  app.delete('/api/v1/boards/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { sub } = (req as typeof req & AuthRequest).user
    const { id, userId } = req.params as { id: string; userId: string }
    if (!mongoose.isValidObjectId(id)) return reply.code(404).send({ error: 'Not found' })
    const board = await Board.findById(id)
    if (!board) return reply.code(404).send({ error: 'Not found' })
    if (!isOwner(board, sub)) return reply.code(403).send({ error: 'Forbidden' })

    const member = board.members.find((m) => m.userId === userId)
    if (!member) return reply.code(404).send({ error: 'Member not found' })

    if (member.role === 'owner') {
      const ownerCount = board.members.filter((m) => m.role === 'owner').length
      if (ownerCount === 1)
        return reply.code(400).send({ error: 'Board must have at least one owner' })
    }

    board.members = board.members.filter((m) => m.userId !== userId)
    await board.save()
    return reply.code(204).send()
  })
}
