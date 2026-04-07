import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Routes, Route, Outlet } from 'react-router-dom'
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
    getUser().then((u) => setUser(u))
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
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/',
    element: <AuthGate />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'boards/:id', element: <Board /> },
      { path: 'boards/:id/cards/:cardId', element: <CardDetail /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
