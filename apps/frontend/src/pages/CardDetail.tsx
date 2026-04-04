import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import type { AttributeFieldSchema } from '@flexboard/shared'
import {
  getCard, updateCard, deleteCard, getColumns, getCardTypes,
  getComments, createComment, updateComment, deleteComment,
  getActivity,
} from '@/lib/api'
import { useUiStore } from '@/store/uiStore'
import { AttributeRow, AttributeInput, AttributeValue } from '@/components/AttributeField'

// ── Helpers ───────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return <span className={`badge badge-${type}`}>{type}</span>
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function activityLabel(event: string, payload: Record<string, unknown>): string {
  switch (event) {
    case 'card.created': return `Created as ${payload.type}`
    case 'card.updated': {
      const fields = (payload.fields as string[] | undefined) ?? []
      return `Updated ${fields.join(', ') || 'card'}`
    }
    case 'card.moved': return 'Moved to another column'
    case 'comment.added': return 'Added a comment'
    default: return event
  }
}

function shortId(sub: string): string {
  return sub.slice(-4).toUpperCase()
}

// ── Comments section ──────────────────────────────────────

interface CommentsSectionProps {
  boardId: string
  cardId: string
  currentSub: string
}

function CommentsSection({ boardId, cardId, currentSub }: CommentsSectionProps) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', boardId, cardId],
    queryFn: () => getComments(boardId, cardId),
  })

  const addMutation = useMutation({
    mutationFn: () => createComment(boardId, cardId, draft.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', boardId, cardId] })
      qc.invalidateQueries({ queryKey: ['activity', boardId, cardId] })
      setDraft('')
    },
  })

  const editMutation = useMutation({
    mutationFn: (id: string) => updateComment(boardId, cardId, id, editBody.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', boardId, cardId] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(boardId, cardId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', boardId, cardId] }),
  })

  return (
    <div className="comments-section">
      <div className="comments-title">Comments {comments.length > 0 && `(${comments.length})`}</div>

      {comments.length === 0 && (
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>No comments yet.</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="comment-item">
          <div className="comment-avatar">{shortId(c.authorId)}</div>
          <div className="comment-body">
            <div className="comment-meta">
              <span className="comment-author">{shortId(c.authorId)}</span>
              <span className="comment-time">{timeAgo(c.createdAt)}</span>
            </div>

            {editingId === c.id ? (
              <>
                <textarea
                  className="form-input form-textarea"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  style={{ fontSize: 13, marginBottom: 6 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => editMutation.mutate(c.id)}
                    disabled={!editBody.trim() || editMutation.isPending}
                  >
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="comment-text">{c.body}</div>
                {c.authorId === currentSub && (
                  <div className="comment-actions">
                    <button
                      className="comment-action-btn"
                      onClick={() => { setEditingId(c.id); setEditBody(c.body) }}
                    >
                      Edit
                    </button>
                    <button
                      className="comment-action-btn danger"
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      <div className="comment-input-wrap">
        <div className="comment-avatar">{shortId(currentSub)}</div>
        <div style={{ flex: 1 }}>
          <div className="comment-input-box">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) {
                  e.preventDefault()
                  addMutation.mutate()
                }
              }}
            />
            <div className="comment-input-footer">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => addMutation.mutate()}
                disabled={!draft.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Activity section ──────────────────────────────────────

function ActivitySection({ boardId, cardId }: { boardId: string; cardId: string }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['activity', boardId, cardId],
    queryFn: () => getActivity(boardId, cardId),
  })

  if (entries.length === 0) return null

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">Activity</div>
      <div className="activity-list">
        {entries.map((e) => (
          <div key={e.id} className="activity-item">
            <div className="activity-dot" />
            <div className="activity-body">
              <div className="activity-text">{activityLabel(e.event, e.payload)}</div>
              <div className="activity-time">{timeAgo(e.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function CardDetail() {
  const { id: boardId, cardId } = useParams<{ id: string; cardId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setBoardName = useUiStore((s) => s.setBoardName)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})

  const { data: card, isLoading } = useQuery({
    queryKey: ['card', boardId, cardId],
    queryFn: () => getCard(boardId!, cardId!),
    enabled: !!boardId && !!cardId,
  })

  const { data: columns } = useQuery({
    queryKey: ['columns', boardId],
    queryFn: () => getColumns(boardId!),
    enabled: !!boardId,
  })

  const { data: cardTypes } = useQuery({
    queryKey: ['card-types'],
    queryFn: getCardTypes,
  })

  // Current user sub from localStorage (set by oidc-client-ts)
  const currentSub: string = (() => {
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith('oidc.user:'))
      if (!key) return ''
      const u = JSON.parse(localStorage.getItem(key) ?? '{}')
      return u.profile?.sub ?? ''
    } catch { return '' }
  })()

  const typeSchema = cardTypes?.find((ct) => ct.type === card?.type)
  const schemaFields: AttributeFieldSchema[] = typeSchema?.attributes ?? []

  useEffect(() => {
    if (card) {
      setEditTitle(card.title)
      setEditDescription(card.description ?? '')
      setEditAttrs({ ...(card.attributes ?? {}) })
    }
  }, [card])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCard(boardId!, cardId!, {
        title: editTitle.trim() || undefined,
        description: editDescription || undefined,
        attributes: editAttrs,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', boardId, cardId] })
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
      qc.invalidateQueries({ queryKey: ['activity', boardId, cardId] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCard(boardId!, cardId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
      navigate(`/boards/${boardId}`)
    },
  })

  const columnName = columns?.find((c) => c.id === card?.columnId)?.name ?? '—'

  const handleAttrChange = (key: string, value: unknown) => {
    setEditAttrs((prev) => {
      const next = { ...prev }
      if (value === undefined || value === null || value === '') {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  // Markdown attribute fields rendered in main panel (below description)
  const markdownFields = schemaFields.filter((f) => f.type === 'markdown')

  if (isLoading) return <div className="loading-center">Loading card…</div>
  if (!card) return <div className="loading-center">Card not found.</div>

  return (
    <div className="detail-layout">
      {/* ── Main panel ── */}
      <div className="detail-main">
        <div className="detail-topbar">
          <Link to={`/boards/${boardId}`} className="btn btn-ghost btn-sm">← Back</Link>
          <TypeBadge type={card.type} />
          <div style={{ flex: 1 }} />
          {!editing && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { if (confirm('Delete this card?')) deleteMutation.mutate() }}
          >
            Delete
          </button>
        </div>

        {editing ? (
          <>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">Title</label>
              <input
                className="form-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ fontSize: 18, fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Markdown)</label>
              <textarea
                className="form-input form-textarea"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={8}
              />
            </div>

            {markdownFields.map((f) => (
              <div key={f.key} className="form-group">
                <label className="form-label">
                  {f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  {f.required && <span className="form-label-req"> *</span>}
                </label>
                <AttributeInput
                  field={f}
                  value={editAttrs[f.key]}
                  onChange={handleAttrChange}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => saveMutation.mutate()}
                disabled={!editTitle.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="detail-title">{card.title}</h1>

            {card.description ? (
              <div className="detail-section">
                <div className="detail-section-label">Description</div>
                <div className="prose">
                  <ReactMarkdown>{card.description}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="detail-section">
                <p className="text-muted" style={{ fontSize: 13 }}>
                  No description. Click Edit to add one.
                </p>
              </div>
            )}

            {markdownFields.map((f) => {
              const val = card.attributes?.[f.key]
              if (!val) return null
              return (
                <div key={f.key} className="detail-section">
                  <div className="detail-section-label">
                    {f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </div>
                  <div className="prose">
                    <ReactMarkdown>{String(val)}</ReactMarkdown>
                  </div>
                </div>
              )
            })}
          </>
        )}

        <CommentsSection boardId={boardId!} cardId={cardId!} currentSub={currentSub} />
      </div>

      {/* ── Sidebar ── */}
      <div className="detail-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Details</div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Type</span>
            <span className="sidebar-field-value"><TypeBadge type={card.type} /></span>
          </div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Column</span>
            <span className="sidebar-field-value">{columnName}</span>
          </div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Created</span>
            <span className="sidebar-field-value">{new Date(card.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Updated</span>
            <span className="sidebar-field-value">{new Date(card.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Attribute sidebar fields — non-markdown schema fields */}
        {schemaFields.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              Attributes
              {!editing && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ float: 'right', fontSize: 11, padding: '2px 6px' }}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              schemaFields
                .filter((f) => f.type !== 'markdown')
                .map((f) => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      {f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      {f.required && <span style={{ color: '#ef4444' }}> *</span>}
                    </div>
                    <AttributeInput
                      field={f}
                      value={editAttrs[f.key]}
                      onChange={handleAttrChange}
                    />
                  </div>
                ))
            ) : (
              schemaFields.map((f) => (
                <AttributeRow key={f.key} field={f} value={card.attributes?.[f.key]} />
              ))
            )}
          </div>
        )}

        <ActivitySection boardId={boardId!} cardId={cardId!} />
      </div>
    </div>
  )
}
