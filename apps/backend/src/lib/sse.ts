import type { ServerResponse } from 'node:http'

// ── Board-level registry ──────────────────────────────────
// boardId → connected SSE clients
const registry = new Map<string, Set<ServerResponse>>()

export function subscribe(boardId: string, res: ServerResponse): void {
  if (!registry.has(boardId)) registry.set(boardId, new Set())
  registry.get(boardId)!.add(res)
}

export function unsubscribe(boardId: string, res: ServerResponse): void {
  const clients = registry.get(boardId)
  if (!clients) return
  clients.delete(res)
  if (clients.size === 0) registry.delete(boardId)
}

export function broadcast(boardId: string, event: string, payload: unknown): void {
  const clients = registry.get(boardId)
  if (!clients?.size) return
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const res of clients) {
    try { res.write(chunk) } catch { /* client already disconnected */ }
  }
}

// ── User-level registry ───────────────────────────────────
// userId → connected SSE clients (for cross-board notifications)
const userRegistry = new Map<string, Set<ServerResponse>>()

export function subscribeUser(userId: string, res: ServerResponse): void {
  if (!userRegistry.has(userId)) userRegistry.set(userId, new Set())
  userRegistry.get(userId)!.add(res)
}

export function unsubscribeUser(userId: string, res: ServerResponse): void {
  const clients = userRegistry.get(userId)
  if (!clients) return
  clients.delete(res)
  if (clients.size === 0) userRegistry.delete(userId)
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  const clients = userRegistry.get(userId)
  if (!clients?.size) return
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const res of clients) {
    try { res.write(chunk) } catch { /* client already disconnected */ }
  }
}
