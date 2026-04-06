import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { type User } from 'oidc-client-ts'
import { getUser, signIn, userManager } from '@/lib/auth'
import AuthCallback from '@/pages/AuthCallback'
import Nav from '@/components/Nav'
import Dashboard from '@/pages/Dashboard'
import Board from '@/pages/Board'
import CardDetail from '@/pages/CardDetail'

function AuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUser().then(async (u) => {
      if (u && !u.expired && !u.profile.preferred_username) {
        // The stored session pre-dates loadUserInfo=true — fetch userinfo now and
        // patch the profile so display name / initials resolve correctly.
        try {
          const res = await fetch('/oidc/v1/userinfo', {
            headers: { Authorization: `Bearer ${u.access_token}` },
          })
          if (res.ok) {
            const info = await res.json() as Record<string, unknown>
            Object.assign(u.profile, info)
            await userManager.storeUser(u)
          }
        } catch { /* non-fatal — display falls back gracefully */ }
      }
      setUser(u)
    })
  }, [])

  useEffect(() => {
    if (user === null || (user && user.expired)) {
      signIn().catch((err: unknown) => {
        console.error('Login redirect failed', err)
        setError(String(err))
      })
    }
  }, [user])

  if (error) return <pre style={{ color: 'red', padding: 20 }}>Login error: {error}</pre>
  if (user === undefined || user === null || user.expired) {
    return <div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Redirecting to login…</div>
  }

  return (
    <>
      <Nav user={user} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/boards/:id" element={<Board />} />
        <Route path="/boards/:id/cards/:cardId" element={<CardDetail />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  )
}
