import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type User } from 'oidc-client-ts'
import { signOut } from '@/lib/auth'
import { getVersion } from '@/lib/api'
import { useUiStore } from '@/store/uiStore'

interface NavProps {
  user: User
}

async function gravatarUrl(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=80`
}

export default function Nav({ user }: NavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [crumbExpanded, setCrumbExpanded] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [gravatarMissing, setGravatarMissing] = useState(false)
  const boardId = useUiStore((s) => s.boardId)
  const boardName = useUiStore((s) => s.boardName)
  const cardTitle = useUiStore((s) => s.cardTitle)

  const initials = (() => {
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

  useEffect(() => {
    const email = user.profile.email
    if (!email) return
    gravatarUrl(email).then(setAvatarSrc)
  }, [user.profile.email])

  const { data: versionData } = useQuery({
    queryKey: ['version'],
    queryFn: getVersion,
    staleTime: Infinity,
  })
  const frontendVersion = __APP_VERSION__
  const backendVersion = versionData?.version
  const versionMismatch = !!backendVersion && backendVersion !== frontendVersion

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-icon">F</span>
        Flexboard
      </Link>

      {boardName && (
        <div className="nav-crumb" data-expanded={crumbExpanded ? 'true' : undefined}>
          {/* "…" expand button — shown on mobile only; hidden at ≥640px via CSS */}
          <button
            className="nav-crumb-expand"
            onClick={() => setCrumbExpanded((e) => !e)}
            aria-label={crumbExpanded ? 'Collapse breadcrumb' : 'Expand breadcrumb'}
          >
            {crumbExpanded ? '‹' : '…'}
          </button>

          {/* Ancestor segments — hidden on mobile unless expanded; always shown at ≥640px */}
          <span className="nav-crumb-sep nav-crumb-ancestor">/</span>
          <Link to="/" className="nav-crumb-ancestor">Boards</Link>

          {cardTitle ? (
            <>
              <span className="nav-crumb-sep nav-crumb-ancestor">/</span>
              <Link to={`/boards/${boardId}`} className="nav-crumb-ancestor">{boardName}</Link>
              <span className="nav-crumb-sep nav-crumb-ancestor">/</span>
              <span className="nav-crumb-current">{cardTitle}</span>
            </>
          ) : (
            <>
              <span className="nav-crumb-sep nav-crumb-ancestor">/</span>
              <span className="nav-crumb-current">{boardName}</span>
            </>
          )}
        </div>
      )}

      <div className="nav-spacer" />

      <div
        className={`nav-version${versionMismatch ? ' nav-version-mismatch' : ''}`}
        title={versionMismatch ? `Frontend: v${frontendVersion} · Backend: v${backendVersion}` : `v${frontendVersion}`}
      >
        v{frontendVersion}
        {versionMismatch && <span className="nav-version-warn">⚠</span>}
      </div>

      <div className="nav-avatar-wrap">
        <button
          className="nav-avatar"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-label="User menu"
        >
          {avatarSrc
            ? <img src={avatarSrc} alt={initials} className="nav-avatar-img" onError={() => { setAvatarSrc(null); setGravatarMissing(true) }} />
            : initials}
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
              {user.profile.email && (
                <a
                  className="nav-dropdown-item"
                  href="https://gravatar.com"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setDropdownOpen(false)}
                >
                  {gravatarMissing ? 'Set up profile picture' : 'Change profile picture'} ↗
                </a>
              )}
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
