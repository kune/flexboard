import { useState } from 'react'
import { Link } from 'react-router-dom'
import { type User } from 'oidc-client-ts'
import { signOut } from '@/lib/auth'
import { useUiStore } from '@/store/uiStore'

interface NavProps {
  user: User
}

export default function Nav({ user }: NavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const boardName = useUiStore((s) => s.boardName)

  const initials = (() => {
    // Full name → two initials; otherwise use the local part of preferred_username / email / sub
    if (user.profile.name) {
      const parts = user.profile.name.split(/\s+/)
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
      return user.profile.name.slice(0, 2).toUpperCase()
    }
    const nick = user.profile.preferred_username ?? user.profile.email ?? user.profile.sub
    const local = nick.includes('@') ? nick.split('@')[0] : nick
    return local.slice(0, 2).toUpperCase()
  })()

  const displayName = user.profile.name ?? user.profile.preferred_username ?? user.profile.email ?? user.profile.sub
  const displayEmail = user.profile.email ?? user.profile.preferred_username ?? user.profile.sub

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-icon">F</span>
        Flexboard
      </Link>

      {boardName && (
        <div className="nav-crumb">
          <span className="nav-crumb-sep">/</span>
          <Link to="/" className="nav-crumb a">Boards</Link>
          <span className="nav-crumb-sep">/</span>
          <span className="nav-crumb-current">{boardName}</span>
        </div>
      )}

      <div className="nav-spacer" />

      <div className="nav-avatar-wrap">
        <button
          className="nav-avatar"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-label="User menu"
        >
          {initials}
        </button>

        {dropdownOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 299 }}
              onClick={() => setDropdownOpen(false)}
            />
            <div className="nav-dropdown">
              <div className="nav-dropdown-header">
                <div className="nav-dropdown-name">{displayName}</div>
                <div className="nav-dropdown-email">{displayEmail}</div>
              </div>
              <button
                className="nav-dropdown-item danger"
                onClick={() => { setDropdownOpen(false); signOut().catch(console.error) }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}
