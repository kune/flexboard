import type { Board, BoardMemberEnriched, Column, Card, CardTypeSchema, Comment, ActivityEntry, UserRole } from '@flexboard/shared'
import { getAccessToken, signOut } from './auth'

const BASE = '/api/v1'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401) {
    // Token is invalid or expired (e.g. after an app reset). Clear the local
    // session and redirect to root — AuthGate will trigger a fresh login.
    await signOut()
    return undefined as T // unreachable: signOut redirects
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Boards ────────────────────────────────────────────────

export const getBoards = () => request<Board[]>('/boards')

export const createBoard = (data: { name: string; description?: string }) =>
  request<Board>('/boards', { method: 'POST', body: JSON.stringify(data) })

export const getBoard = (id: string) => request<Board>(`/boards/${id}`)

export const updateBoard = (id: string, data: { name?: string; description?: string }) =>
  request<Board>(`/boards/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteBoard = (id: string) => request<void>(`/boards/${id}`, { method: 'DELETE' })

// ── Columns ───────────────────────────────────────────────

export const getColumns = (boardId: string) => request<Column[]>(`/boards/${boardId}/columns`)

export const createColumn = (boardId: string, data: { name: string }) =>
  request<Column>(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify(data) })

export const updateColumn = (boardId: string, id: string, data: { name?: string; position?: number }) =>
  request<Column>(`/boards/${boardId}/columns/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteColumn = (boardId: string, id: string) =>
  request<void>(`/boards/${boardId}/columns/${id}`, { method: 'DELETE' })

// ── Cards ─────────────────────────────────────────────────

export const getCards = (boardId: string) => request<Card[]>(`/boards/${boardId}/cards`)

export const createCard = (
  boardId: string,
  data: { columnId: string; type: string; title: string; description?: string; attributes?: Record<string, unknown> },
) => request<Card>(`/boards/${boardId}/cards`, { method: 'POST', body: JSON.stringify(data) })

export const getCard = (boardId: string, id: string) =>
  request<Card>(`/boards/${boardId}/cards/${id}`)

export const updateCard = (
  boardId: string,
  id: string,
  data: { columnId?: string; title?: string; description?: string; position?: number; attributes?: Record<string, unknown> },
) => request<Card>(`/boards/${boardId}/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteCard = (boardId: string, id: string) =>
  request<void>(`/boards/${boardId}/cards/${id}`, { method: 'DELETE' })

// ── Card Types ────────────────────────────────────────────

export const getCardTypes = () => request<CardTypeSchema[]>('/card-types')

// ── Comments ──────────────────────────────────────────────

export const getComments = (boardId: string, cardId: string) =>
  request<Comment[]>(`/boards/${boardId}/cards/${cardId}/comments`)

export const createComment = (boardId: string, cardId: string, body: string) =>
  request<Comment>(`/boards/${boardId}/cards/${cardId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })

export const updateComment = (boardId: string, cardId: string, id: string, body: string) =>
  request<Comment>(`/boards/${boardId}/cards/${cardId}/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  })

export const deleteComment = (boardId: string, cardId: string, id: string) =>
  request<void>(`/boards/${boardId}/cards/${cardId}/comments/${id}`, { method: 'DELETE' })

// ── Activity ──────────────────────────────────────────────

export const getActivity = (boardId: string, cardId: string) =>
  request<ActivityEntry[]>(`/boards/${boardId}/cards/${cardId}/activity`)

// ── Members ───────────────────────────────────────────────

export const getMembers = (boardId: string) =>
  request<BoardMemberEnriched[]>(`/boards/${boardId}/members`)

export const addMember = (boardId: string, data: { email: string; role: UserRole }) =>
  request<BoardMemberEnriched>(`/boards/${boardId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateMember = (boardId: string, userId: string, role: UserRole) =>
  request<{ userId: string; role: UserRole }>(`/boards/${boardId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

export const removeMember = (boardId: string, userId: string) =>
  request<void>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' })

// ── User search ───────────────────────────────────────────

export const searchUsers = (email: string) =>
  request<{ sub: string; email: string; name: string }[]>(`/users?email=${encodeURIComponent(email)}`)
