import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'

/**
 * Opens a user-level Server-Sent Events connection and invalidates the
 * boards query whenever the current user's board membership changes
 * (added to a board, removed, or role updated by another user).
 */
export function useUserSSE(): void {
  const qc = useQueryClient()

  useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false
    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      getAccessToken().then((token) => {
        if (cancelled || !token) return

        es = new EventSource(`/api/v1/events?token=${encodeURIComponent(token)}`)

        es.addEventListener('boards.changed', () => {
          qc.invalidateQueries({ queryKey: ['boards'] })
        })

        es.onerror = () => {
          es?.close()
          es = null
          if (cancelled) return
          if (retryCount < 3) {
            retryTimer = setTimeout(() => {
              retryCount++
              connect()
            }, 1000 * 2 ** retryCount)
          }
        }

        es.onopen = () => { retryCount = 0 }
      })
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [qc])
}
