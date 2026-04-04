import ReactMarkdown from 'react-markdown'
import type { AttributeFieldSchema } from '@flexboard/shared'

function labelFor(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── View mode ─────────────────────────────────────────────

interface AttributeValueProps {
  field: AttributeFieldSchema
  value: unknown
}

export function AttributeValue({ field, value }: AttributeValueProps) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-light">—</span>
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

// ── Edit mode ─────────────────────────────────────────────

interface AttributeInputProps {
  field: AttributeFieldSchema
  value: unknown
  onChange: (key: string, value: unknown) => void
}

export function AttributeInput({ field, value, onChange }: AttributeInputProps) {
  const strVal = value === undefined || value === null ? '' : String(
    Array.isArray(value) ? (value as unknown[]).join(', ') : value,
  )

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
    // date inputs need YYYY-MM-DD format
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
    return (
      <input
        type="text"
        className="form-input"
        value={strVal}
        onChange={(e) => {
          const arr = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
          onChange(field.key, arr.length ? arr : undefined)
        }}
        placeholder="Comma-separated values"
      />
    )
  }

  // string, reference → plain text
  return (
    <input
      type="text"
      className="form-input"
      value={strVal}
      onChange={(e) => onChange(field.key, e.target.value || undefined)}
      placeholder={field.type === 'reference' ? 'User ID' : undefined}
    />
  )
}

// ── Sidebar row ───────────────────────────────────────────

interface AttributeRowProps {
  field: AttributeFieldSchema
  value: unknown
}

export function AttributeRow({ field, value }: AttributeRowProps) {
  // Skip markdown fields in sidebar — they belong in the main panel
  if (field.type === 'markdown') return null
  return (
    <div className="sidebar-field">
      <span className="sidebar-field-label">{labelFor(field.key)}</span>
      <span className="sidebar-field-value">
        <AttributeValue field={field} value={value} />
      </span>
    </div>
  )
}
