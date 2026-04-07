import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AttributeFieldSchema } from '@flexboard/shared'
import type { BoardMemberEnriched } from '@flexboard/shared'

function labelFor(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Member combobox (for reference fields) ────────────────

interface MemberComboboxProps {
  members: BoardMemberEnriched[]
  value: string   // the stored sub
  onChange: (sub: string | undefined) => void
}

function MemberCombobox({ members, value, onChange }: MemberComboboxProps) {
  const selected = members.find((m) => m.userId === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep input in sync when value changes externally
  useEffect(() => {
    setQuery(selected?.name ?? '')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = members.filter((m) => {
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Reset input to selected name if user blurred without picking
        setQuery(selected?.name ?? '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected])

  const handleSelect = (m: BoardMemberEnriched) => {
    onChange(m.userId)
    setQuery(m.name)
    setOpen(false)
  }

  const handleClear = () => {
    onChange(undefined)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search members…"
          value={query}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ paddingRight: value ? 28 : undefined }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0,
            }}
            title="Clear"
          >×</button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.1)', marginTop: 2,
          maxHeight: 180, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13 }}>No members found</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.userId}
                type="button"
                onMouseDown={() => handleSelect(m)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', background: m.userId === value ? '#eff6ff' : 'none',
                  border: 'none', cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={(e) => { if (m.userId !== value) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={(e) => { if (m.userId !== value) e.currentTarget.style.background = 'none' }}
              >
                <div style={{ fontWeight: 500 }}>{m.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{m.email}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── View mode ─────────────────────────────────────────────

interface AttributeValueProps {
  field: AttributeFieldSchema
  value: unknown
  nameMap?: Map<string, string>
}

export function AttributeValue({ field, value, nameMap }: AttributeValueProps) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-light">—</span>
  }
  if (field.type === 'reference' && nameMap) {
    const name = nameMap.get(String(value))
    return <span>{name ?? String(value)}</span>
  }
  if (field.type === 'string[]') {
    const arr = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim())
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
        {arr.filter(Boolean).map((tag, i) => (
          <span key={i} className="label-tag">{String(tag)}</span>
        ))}
      </span>
    )
  }
  if (field.type === 'markdown') {
    return (
      <div className="prose" style={{ fontSize: 12, textAlign: 'left' }}>
        <ReactMarkdown>{String(value)}</ReactMarkdown>
      </div>
    )
  }
  if (field.type === 'date') {
    return <span>{new Date(String(value)).toLocaleDateString()}</span>
  }
  return <span>{String(value)}</span>
}

// ── String array input (commit on blur, not on every keystroke) ──────────────

function toRaw(value: unknown): string {
  if (Array.isArray(value)) return (value as string[]).join(', ')
  if (typeof value === 'string') return value
  return ''
}

function StringArrayInput({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const [raw, setRaw] = useState(() => toRaw(value))

  // Reset local text when the parent value changes (e.g. edit cancelled)
  useEffect(() => { setRaw(toRaw(value)) }, [value])

  const commit = useCallback((text: string) => {
    const arr = text.split(',').map((s) => s.trim()).filter(Boolean)
    onChange(fieldKey, arr.length ? arr : undefined)
  }, [fieldKey, onChange])

  return (
    <input
      type="text"
      className="form-input"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      placeholder="Comma-separated, e.g. ux, feat, bug"
    />
  )
}

// ── Edit mode ─────────────────────────────────────────────

interface AttributeInputProps {
  field: AttributeFieldSchema
  value: unknown
  onChange: (key: string, value: unknown) => void
  members?: BoardMemberEnriched[]
}

export function AttributeInput({ field, value, onChange, members }: AttributeInputProps) {
  const strVal = value === undefined || value === null ? '' : String(
    Array.isArray(value) ? (value as unknown[]).join(', ') : value,
  )

  if (field.type === 'reference' && members) {
    return (
      <MemberCombobox
        members={members}
        value={strVal}
        onChange={(sub) => onChange(field.key, sub)}
      />
    )
  }

  if (field.type === 'enum') {
    return (
      <select
        className="form-select"
        value={strVal}
        onChange={(e) => onChange(field.key, e.target.value || undefined)}
      >
        <option value="">— none —</option>
        {field.values?.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className="form-input"
        value={strVal}
        onChange={(e) => onChange(field.key, e.target.value === '' ? undefined : Number(e.target.value))}
      />
    )
  }

  if (field.type === 'date') {
    const dateVal = strVal ? new Date(strVal).toISOString().slice(0, 10) : ''
    return (
      <input
        type="date"
        className="form-input"
        value={dateVal}
        onChange={(e) => onChange(field.key, e.target.value || undefined)}
      />
    )
  }

  if (field.type === 'markdown') {
    return (
      <textarea
        className="form-input form-textarea"
        rows={4}
        value={strVal}
        onChange={(e) => onChange(field.key, e.target.value || undefined)}
        placeholder={`${labelFor(field.key)} (Markdown)`}
      />
    )
  }

  if (field.type === 'string[]') {
    return <StringArrayInput fieldKey={field.key} value={value} onChange={onChange} />
  }

  // string → plain text
  return (
    <input
      type="text"
      className="form-input"
      value={strVal}
      onChange={(e) => onChange(field.key, e.target.value || undefined)}
    />
  )
}

// ── Sidebar row ───────────────────────────────────────────

interface AttributeRowProps {
  field: AttributeFieldSchema
  value: unknown
  nameMap?: Map<string, string>
}

export function AttributeRow({ field, value, nameMap }: AttributeRowProps) {
  if (field.type === 'markdown') return null
  return (
    <div className="sidebar-field">
      <span className="sidebar-field-label">{labelFor(field.key)}</span>
      <span className="sidebar-field-value">
        <AttributeValue field={field} value={value} nameMap={nameMap} />
      </span>
    </div>
  )
}
