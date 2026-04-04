import { useEffect, useRef } from 'react'
import { signInCallback } from '@/lib/auth'

/**
 * Handles the OIDC redirect callback from Zitadel.
 * Completes the code exchange then redirects to the app root.
 */
export default function AuthCallback() {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    signInCallback()
      .then(() => {
        window.location.replace('/')
      })
      .catch((err) => {
        console.error('Auth callback failed', err)
        window.location.replace('/')
      })
  }, [])

  return <p>Signing in…</p>
}
