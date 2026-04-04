import { z } from 'zod'

// ── Boards ────────────────────────────────────────────────

export const CreateBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export const UpdateBoardSchema = CreateBoardSchema.partial()

// ── Columns ───────────────────────────────────────────────

export const CreateColumnSchema = z.object({
  name: z.string().min(1).max(100),
})

export const UpdateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
})

// ── Cards ─────────────────────────────────────────────────

export const CardTypeEnum = z.enum(['task', 'bug', 'story', 'epic'])

export const CreateCardSchema = z.object({
  type: CardTypeEnum,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  columnId: z.string(),
  attributes: z.record(z.unknown()).default({}),
})

export const UpdateCardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
})

export const MoveCardSchema = z.object({
  columnId: z.string(),
  position: z.number().int().min(0),
})

// ── Comments ──────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  body: z.string().min(1),
})

export const UpdateCommentSchema = z.object({
  body: z.string().min(1),
})

// ── Inferred types ────────────────────────────────────────

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>
export type UpdateBoardInput = z.infer<typeof UpdateBoardSchema>
export type CreateColumnInput = z.infer<typeof CreateColumnSchema>
export type UpdateColumnInput = z.infer<typeof UpdateColumnSchema>
export type CreateCardInput = z.infer<typeof CreateCardSchema>
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>
export type MoveCardInput = z.infer<typeof MoveCardSchema>
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>
