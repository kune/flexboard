export type CardType = 'task' | 'bug' | 'story' | 'epic'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type UserRole = 'owner' | 'editor' | 'viewer'

export type AttributeType =
  | 'string'
  | 'string[]'
  | 'number'
  | 'date'
  | 'enum'
  | 'markdown'
  | 'reference'

export interface AttributeFieldSchema {
  key: string
  type: AttributeType
  required: boolean
  values?: string[] // for enum type
}

export interface CardTypeSchema {
  type: string
  label: string
  attributes: AttributeFieldSchema[]
}

export interface BoardMember {
  userId: string
  role: UserRole
}

export interface Board {
  id: string
  name: string
  description?: string
  members: BoardMember[]
  createdAt: string
  updatedAt: string
}

export interface BoardMemberEnriched extends BoardMember {
  email: string
  name: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  position: number
  createdAt: string
}

export interface Card {
  id: string
  boardId: string
  columnId: string
  type: CardType
  title: string
  description?: string
  status: string
  position: number
  createdBy: string
  createdAt: string
  updatedAt: string
  attributes: Record<string, unknown>
}

export interface Comment {
  id: string
  cardId: string
  authorId: string
  body: string
  createdAt: string
  updatedAt?: string
}

export interface ActivityEntry {
  id: string
  cardId: string
  boardId: string
  actorId: string
  event: string
  payload: Record<string, unknown>
  createdAt: string
}

// SSE event envelope
export interface SseEvent<T = unknown> {
  type: string
  payload: T
}
