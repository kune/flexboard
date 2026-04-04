import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'

/**
 * Opens a Server-Sent Events connection for the given board and invalidates
 * the appropriate TanStack Query caches when events arrive.
 *
 * EventSource doesn't support custom headers, so the access token is passed
 * as a ?token= query parameter. On reconnect (auto or manual), a fresh token
 * is fetched so an expiring session doesn't permanently break the stream.
 */
export function useBoardSSE(boardId: string | undefined): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!boardId) return

    let es: EventSource | null = null
    let cancelled = false
    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      getAccessToken().then((token) => {
        if (cancelled || !token) return

        es = new EventSource(
          `/api/v1/boards/${boardId}/events?token=${encodeURIComponent(token)}`,
        )

        es.addEventListener('card.created', () => {
          qc.invalidateQueries({ queryKey: ['cards', boardId] })
        })

        es.addEventListener('card.updated', (e) => {
          const data = JSON.parse((e as MessageEvent).data) as { cardId?: string }
          qc.invalidateQueries({ queryKey: ['cards', boardId] })
          if (data.cardId) {
            qc.invalidateQueries({ queryKey: ['card', boardId, data.cardId] })
            qc.invalidateQueries({ queryKey: ['activity', boardId, data.cardId] })
          }
        })

        es.addEventListener('card.moved', () => {
          qc.invalidateQueries({ queryKey: ['cards', boardId] })
        })

        es.addEventListener('card.deleted', () => {
          qc.invalidateQueries({ queryKey: ['cards', boardId] })
        })

        es.addEventListener('column.created', () => {
          qc.invalidateQueries({ queryKey: ['columns', boardId] })
        })

        es.addEventListener('column.updated', () => {
          qc.invalidateQueries({ queryKey: ['columns', boardId] })
        })

        es.addEventListener('column.deleted', () => {
          qc.invalidateQueries({ queryKey: ['columns', boardId] })
          qc.invalidateQueries({ queryKey: ['cards', boardId] })
        })

        es.addEventListener('comment.added', (e) => {
          const data = JSON.parse((e as MessageEvent).data) as { cardId?: string }
          if (data.cardId) {
            qc.invalidateQueries({ queryKey: ['comments', boardId, data.cardId] })
            qc.invalidateQueries({ queryKey: ['activity', boardId, data.cardId] })
          }
        })

        es.onerror = () => {
          es?.close()
          es = null
          if (cancelled) return
          // Exponential backoff: 1 s, 2 s, 4 s, then give up
          if (retryCount < 3) {
            retryTimer = setTimeout(() => {
              retryCount++
              connect()
            }, 1000 * 2 ** retryCount)
          }
        }

        // Reset retry count once the connection is established
        es.onopen = () => { retryCount = 0 }
      })
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [boardId, qc])
}
