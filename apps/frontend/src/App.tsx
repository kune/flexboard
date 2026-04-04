import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { type User } from 'oidc-client-ts'
import { getUser, signIn } from '@/lib/auth'
import AuthCallback from '@/pages/AuthCallback'
import Nav from '@/components/Nav'
import Dashboard from '@/pages/Dashboard'
import Board from '@/pages/Board'
import CardDetail from '@/pages/CardDetail'

function AuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUser().then(setUser)
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
