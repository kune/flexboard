import type { UserRole } from '@flexboard/shared'
import type { IBoard } from '../models/board.js'

const ROLE_LEVEL: Record<UserRole, number> = { viewer: 0, editor: 1, owner: 2 }

export function getMemberRole(board: IBoard, sub: string): UserRole | null {
  return board.members.find((m) => m.userId === sub)?.role ?? null
}

export function hasRole(board: IBoard, sub: string, minRole: UserRole): boolean {
  const role = getMemberRole(board, sub)
  if (!role) return false
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]
}

// Convenience helpers used across route files
export const canRead  = (board: IBoard, sub: string) => hasRole(board, sub, 'viewer')
export const canWrite = (board: IBoard, sub: string) => hasRole(board, sub, 'editor')
export const isOwner  = (board: IBoard, sub: string) => hasRole(board, sub, 'owner')
