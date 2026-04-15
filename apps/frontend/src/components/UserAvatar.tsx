import { useState, useEffect } from 'react'

const AVATAR_COLORS = ['av-blue', 'av-purple', 'av-green', 'av-orange', 'av-red']

function colorClass(sub: string): string {
  let h = 0
  for (let i = 0; i < sub.length; i++) h = (h * 31 + sub.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

async function buildAvatarUrl(email: string, px: number): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `https://seccdn.libravatar.org/avatar/${hash}?d=404&s=${px * 2}`
}

interface UserAvatarProps {
  /** Display name — used for initials fallback */
  name: string
  /** Email address — used to load Libravatar */
  email?: string
  /** User ID / sub — used for deterministic colour when falling back to initials */
  sub?: string
  /** Diameter in px (default 28) */
  size?: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

export default function UserAvatar({
  name,
  email,
  sub,
  size = 28,
  title,
  style,
  className = '',
}: UserAvatarProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    setSrc(null)
    if (!email) return
    buildAvatarUrl(email, size).then(setSrc)
  }, [email, size])

  const color = colorClass(sub ?? name)
  const abbr = initials(name)
  const fontSize = Math.round(size * 0.43)
  const baseStyle: React.CSSProperties = { width: size, height: size, ...style }

  if (src) {
    return (
      <span
        className={`avatar ${className}`}
        style={baseStyle}
        title={title ?? name}
      >
        <img
          src={src}
          alt={abbr}
          className="nav-avatar-img"
          onError={() => setSrc(null)}
        />
      </span>
    )
  }

  return (
    <span
      className={`avatar ${color} ${className}`}
      style={{ ...baseStyle, fontSize }}
      title={title ?? name}
    >
      {abbr}
    </span>
  )
}
