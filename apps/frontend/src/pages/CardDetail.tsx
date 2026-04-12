import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useBlocker, useLocation, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { remarkPlugins, rehypePlugins } from '@/lib/markdown'
import type { AttributeFieldSchema } from '@flexboard/shared'
import {
  getBoard, getCard, updateCard, deleteCard, getColumns, getCardTypes,
  getComments, createComment, updateComment, deleteComment,
  getActivity, getMembers,
} from '@/lib/api'
import { useUiStore } from '@/store/uiStore'
import { useBoardSSE } from '@/hooks/useBoardSSE'
import { AttributeRow, AttributeInput, AttributeValue } from '@/components/AttributeField'
import ConfirmDialog from '@/components/ConfirmDialog'
import MarkdownEditor from '@/components/MarkdownEditor'

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function isFieldDirty(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

// ── Checklist helpers ─────────────────────────────────────

function toggleCheckbox(markdown: string, index: number): string {
  let count = 0
  return markdown.replace(/^(\s*[-*+] )\[([x ])\]/gim, (_match, prefix, state) => {
    if (count++ === index) return `${prefix}[${state === ' ' ? 'x' : ' '}]`
    return _match
  })
}

function makeCheckboxComponents(onToggle: (i: number) => void) {
  let idx = 0
  return {
    input({ type, checked }: React.ComponentProps<'input'> & { node?: object }) {
      if (type !== 'checkbox') return null
      const i = idx++
      return <input type="checkbox" checked={!!checked} onChange={() => onToggle(i)} />
    },
  }
}

// ── Comments section ──────────────────────────────────────

interface CommentsSectionProps {
  boardId: string
  cardId: string
  currentSub: string
  nameMap: Map<string, string>
  draft: string
  onDraftChange: (v: string) => void
  onEditDirtyChange: (dirty: boolean) => void
  cancelEditSeq: number
}

function CommentsSection({ boardId, cardId, currentSub, nameMap, draft, onDraftChange, onEditDirtyChange, cancelEditSeq }: CommentsSectionProps) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editOriginalBody, setEditOriginalBody] = useState('')
  const [confirm, setConfirm] = useState<{ message: string; detail?: string; onConfirm: () => void } | null>(null)

  const editDirty = editingId !== null && editBody.trim() !== editOriginalBody.trim()

  useEffect(() => {
    onEditDirtyChange(editDirty)
  }, [editDirty, onEditDirtyChange])

  // Parent signals "cancel any open edit" by incrementing cancelEditSeq
  const prevCancelSeq = useRef(cancelEditSeq)
  useEffect(() => {
    if (cancelEditSeq !== prevCancelSeq.current) {
      prevCancelSeq.current = cancelEditSeq
      setEditingId(null)
      setEditBody('')
      setEditOriginalBody('')
    }
  }, [cancelEditSeq])

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', boardId, cardId],
    queryFn: () => getComments(boardId, cardId),
  })

  const addMutation = useMutation({
    mutationFn: () => createComment(boardId, cardId, draft.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', boardId, cardId] })
      qc.invalidateQueries({ queryKey: ['activity', boardId, cardId] })
      onDraftChange('')
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

  const startEdit = (id: string, body: string) => {
    setEditingId(id)
    setEditBody(body)
    setEditOriginalBody(body)
  }

  const cancelEdit = () => {
    if (editBody.trim() !== editOriginalBody.trim()) {
      setConfirm({
        message: 'Discard changes?',
        detail: 'Your edits to this comment will be lost.',
        onConfirm: () => { setEditingId(null); setConfirm(null) },
      })
    } else {
      setEditingId(null)
    }
  }

  const confirmDelete = (id: string) => {
    setConfirm({
      message: 'Delete comment?',
      detail: 'This action cannot be undone.',
      onConfirm: () => { deleteMutation.mutate(id); setConfirm(null) },
    })
  }

  return (
    <div className="comments-section">
      <div className="comments-title">Comments {comments.length > 0 && `(${comments.length})`}</div>

      {comments.length === 0 && (
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>No comments yet.</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="comment-item">
          <div className="comment-avatar">{initials(nameMap.get(c.authorId) ?? c.authorId)}</div>
          <div className="comment-body">
            <div className="comment-meta">
              <span className="comment-author">{nameMap.get(c.authorId) ?? c.authorId}</span>
              <span className="comment-time">{timeAgo(c.createdAt)}</span>
            </div>

            {editingId === c.id ? (
              <>
                <div style={editDirty ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6', marginBottom: 6 } : { marginBottom: 6 }}>
                  <textarea
                    className="form-input form-textarea"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    style={{ fontSize: 13, marginBottom: 0 }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => editMutation.mutate(c.id)}
                    disabled={!editBody.trim() || editMutation.isPending}
                  >
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                    Cancel
                  </button>
                  {editDirty && <span style={{ color: '#3b82f6', fontSize: 13, marginLeft: 2 }}>✎</span>}
                </div>
              </>
            ) : (
              <>
                <div className="comment-text">{c.body}</div>
                {c.authorId === currentSub && (
                  <div className="comment-actions">
                    <button
                      className="comment-action-btn"
                      onClick={() => startEdit(c.id, c.body)}
                    >
                      Edit
                    </button>
                    <button
                      className="comment-action-btn danger"
                      onClick={() => confirmDelete(c.id)}
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
        <div className="comment-avatar">{initials(nameMap.get(currentSub) ?? currentSub)}</div>
        <div style={{ flex: 1 }}>
          <div
            className="comment-input-box"
            style={draft.trim() ? { boxShadow: '0 0 0 2px #3b82f6' } : {}}
          >
            <textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Add a comment…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && draft.trim()) {
                  e.preventDefault()
                  addMutation.mutate()
                }
              }}
            />
            <div className="comment-input-footer">
              {draft.trim() && (
                <span style={{ marginRight: 'auto', color: '#3b82f6', fontSize: 13 }}>✎</span>
              )}
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

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          detail={confirm.detail}
          confirmLabel="Discard"
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
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
  const location = useLocation()
  const startInEdit = !!(location.state as { startEdit?: boolean } | null)?.startEdit
  const qc = useQueryClient()
  const setBoardCrumb = useUiStore((s) => s.setBoardCrumb)
  const setCardTitle = useUiStore((s) => s.setCardTitle)

  const [editing, setEditing] = useState(false)
  const [attrOpen, setAttrOpen] = useState(true)
  const [descFullscreen, setDescFullscreen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})
  const [editColumnId, setEditColumnId] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentEditDirty, setCommentEditDirty] = useState(false)
  const [commentEditCancelSeq, setCommentEditCancelSeq] = useState(0)
  const [confirm, setConfirm] = useState<{ message: string; detail?: string; danger?: boolean; confirmLabel?: string; onConfirm: () => void } | null>(null)

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId!),
    enabled: !!boardId,
  })

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

  const { data: members } = useQuery({
    queryKey: ['members', boardId],
    queryFn: () => getMembers(boardId!),
    enabled: !!boardId,
  })

  const nameMap = new Map(members?.map((m) => [m.userId, m.name]) ?? [])

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
    setBoardCrumb(boardId ?? null, board?.name ?? null)
    return () => setBoardCrumb(null, null)
  }, [boardId, board?.name, setBoardCrumb])

  useEffect(() => {
    setCardTitle(card?.title ?? null)
    return () => setCardTitle(null)
  }, [card?.title, setCardTitle])

  useEffect(() => {
    if (card) {
      setEditTitle(card.title)
      setEditDescription(card.description ?? '')
      setEditAttrs({ ...(card.attributes ?? {}) })
      setEditColumnId(card.columnId)
      if (startInEdit) setEditing(true)
    }
  }, [card]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCard(boardId!, cardId!, {
        title: editTitle.trim() || undefined,
        description: editDescription || undefined,
        attributes: editAttrs,
        ...(editColumnId !== card!.columnId ? { columnId: editColumnId } : {}),
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

  const checkboxMutation = useMutation({
    mutationFn: (data: { description?: string; attributes?: Record<string, unknown> }) =>
      updateCard(boardId!, cardId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', boardId, cardId] })
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
      qc.invalidateQueries({ queryKey: ['activity', boardId, cardId] })
    },
  })

  const handleDescCheckbox = (idx: number) => {
    if (!card?.description || editing) return
    checkboxMutation.mutate({ description: toggleCheckbox(card.description, idx) })
  }

  const handleAttrCheckbox = (fieldKey: string) => (idx: number) => {
    if (editing) return
    const current = String(card?.attributes?.[fieldKey] ?? '')
    checkboxMutation.mutate({ attributes: { ...(card?.attributes ?? {}), [fieldKey]: toggleCheckbox(current, idx) } })
  }

  useBoardSSE(boardId)

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

  // Dirty check — safe to compute before early returns because !!card guards it
  const isDirty = (!!card && editing && (
    editTitle !== card.title ||
    editDescription !== (card.description ?? '') ||
    JSON.stringify(editAttrs) !== JSON.stringify(card.attributes ?? {}) ||
    editColumnId !== card.columnId
  )) || commentDraft.trim() !== '' || commentEditDirty

  // Block in-app navigation (React Router links, browser back/forward within SPA)
  const blocker = useBlocker(isDirty)

  // Block browser-native navigation (address bar, close tab, hard reload)
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Dirty indicator in browser tab title
  useEffect(() => {
    const title = card?.title ?? 'Card'
    document.title = isDirty ? `• ${title} – Flexboard` : `${title} – Flexboard`
    return () => { document.title = 'Flexboard' }
  }, [isDirty, card?.title])

  if (isLoading) return <div className="loading-center">Loading card…</div>
  if (!card) return <div className="loading-center">Card not found.</div>

  const isCardDirty = editing && (
    editTitle !== card.title ||
    editDescription !== (card.description ?? '') ||
    JSON.stringify(editAttrs) !== JSON.stringify(card.attributes ?? {}) ||
    editColumnId !== card.columnId
  )
  const titleDirty = editing && editTitle !== card.title
  const descDirty  = editing && editDescription !== (card.description ?? '')
  const attrDirty  = (key: string) => editing && isFieldDirty(editAttrs[key], card.attributes?.[key])

  const resetEdit = () => {
    setEditTitle(card.title)
    setEditDescription(card.description ?? '')
    setEditAttrs({ ...(card.attributes ?? {}) })
    setEditColumnId(card.columnId)
    setEditing(false)
  }

  return (
    <>
    <div className="detail-layout">
      {/* ── Main panel ── */}
      <div className="detail-main">
        <div className="detail-topbar">
          <Link to={`/boards/${boardId}`} className="btn btn-ghost btn-sm">← Back</Link>
          <TypeBadge type={card.type} />
          <div style={{ flex: 1 }} />
          <div className="detail-topbar-actions">
            {editing ? (
              <>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!editTitle.trim() || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const dirty =
                      editTitle !== card.title ||
                      editDescription !== (card.description ?? '') ||
                      JSON.stringify(editAttrs) !== JSON.stringify(card.attributes ?? {})
                    if (dirty) {
                      setConfirm({
                        message: 'Discard changes?',
                        detail: 'Your unsaved edits to this card will be lost.',
                        danger: true,
                        confirmLabel: 'Discard',
                        onConfirm: () => { resetEdit(); setConfirm(null) },
                      })
                    } else {
                      resetEdit()
                    }
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setConfirm({
                message: 'Delete card?',
                detail: `"${card.title}" will be permanently deleted.`,
                danger: true,
                confirmLabel: 'Delete',
                onConfirm: () => { deleteMutation.mutate(); setConfirm(null) },
              })}
            >
              Delete
            </button>
          </div>
        </div>

        {editing ? (
          <>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">
                Title{titleDirty && <span style={{ marginLeft: 5, color: '#3b82f6', fontWeight: 400, fontSize: 13 }}>✎</span>}
              </label>
              <div style={titleDirty ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6' } : {}}>
                <input
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ fontSize: 18, fontWeight: 700 }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span className="form-label" style={{ marginBottom: 0 }}>
                  Description{descDirty && <span style={{ marginLeft: 5, color: '#3b82f6', fontWeight: 400, fontSize: 13 }}>✎</span>}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm md-fullscreen-btn"
                  style={{ marginLeft: 'auto', fontSize: 16, padding: '6px 10px' }}
                  onClick={() => setDescFullscreen(true)}
                  title="Fullscreen edit"
                  aria-label="Edit description fullscreen"
                >
                  ⛶
                </button>
              </div>
              <div style={descDirty ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6' } : {}}>
                <MarkdownEditor
                  value={editDescription}
                  onChange={setEditDescription}
                  rows={10}
                  placeholder="Description…"
                />
              </div>
            </div>

            {markdownFields.map((f) => {
              const dirty = attrDirty(f.key)
              return (
                <div key={f.key} className="form-group">
                  <label className="form-label">
                    {f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    {f.required && <span className="form-label-req"> *</span>}
                    {dirty && <span style={{ marginLeft: 5, color: '#3b82f6', fontWeight: 400, fontSize: 13 }}>✎</span>}
                  </label>
                  <div style={dirty ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6' } : {}}>
                    <AttributeInput
                      field={f}
                      value={editAttrs[f.key]}
                      onChange={handleAttrChange}
                      members={members}
                    />
                  </div>
                </div>
              )
            })}

          </>
        ) : (
          <>
            <h1 className="detail-title">{card.title}</h1>

            {card.description ? (
              <div className="detail-section">
                <div className="detail-section-label">Description</div>
                <div className="prose">
                  <ReactMarkdown
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                    components={makeCheckboxComponents(handleDescCheckbox)}
                  >
                    {card.description}
                  </ReactMarkdown>
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
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={makeCheckboxComponents(handleAttrCheckbox(f.key))}
                    >
                      {String(val)}
                    </ReactMarkdown>
                  </div>
                </div>
              )
            })}
          </>
        )}

        <CommentsSection boardId={boardId!} cardId={cardId!} currentSub={currentSub} nameMap={nameMap} draft={commentDraft} onDraftChange={setCommentDraft} onEditDirtyChange={setCommentEditDirty} cancelEditSeq={commentEditCancelSeq} />
        {isDirty && <div style={{ height: 52 }} />}
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
            <span className="sidebar-field-label">Created</span>
            <span className="sidebar-field-value">{new Date(card.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Updated</span>
            <span className="sidebar-field-value">{new Date(card.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Attribute sidebar fields — non-markdown schema fields */}
        <div className="sidebar-section">
            <div className="sidebar-section-header">
              <button
                className="sidebar-section-accordion"
                onClick={() => setAttrOpen((o) => !o)}
                aria-expanded={attrOpen}
              >
                <span className="sidebar-section-title">Attributes</span>
                <span className="sidebar-accordion-icon">{attrOpen ? '▲' : '▼'}</span>
              </button>
              {!editing && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '2px 6px' }}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>

            {attrOpen && (editing ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Column
                    {editColumnId !== card.columnId && <span style={{ marginLeft: 5, color: '#3b82f6' }}>✎</span>}
                  </div>
                  <div style={editColumnId !== card.columnId ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6' } : {}}>
                    <select
                      className="form-select"
                      value={editColumnId}
                      onChange={(e) => setEditColumnId(e.target.value)}
                    >
                      {columns?.map((col) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {schemaFields
                  .filter((f) => f.type !== 'markdown')
                  .map((f) => {
                    const dirty = attrDirty(f.key)
                    return (
                      <div key={f.key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                          {f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          {f.required && <span style={{ color: '#ef4444' }}> *</span>}
                          {dirty && <span style={{ marginLeft: 5, color: '#3b82f6' }}>✎</span>}
                        </div>
                        <div style={dirty ? { borderRadius: 6, boxShadow: '0 0 0 2px #3b82f6' } : {}}>
                          <AttributeInput
                            field={f}
                            value={editAttrs[f.key]}
                            onChange={handleAttrChange}
                            members={members}
                          />
                        </div>
                      </div>
                    )
                  })}
              </>
            ) : (
              <>
                <div className="sidebar-field">
                  <span className="sidebar-field-label">Column</span>
                  <span className="sidebar-field-value">{columnName}</span>
                </div>
                {schemaFields.map((f) => (
                  <AttributeRow key={f.key} field={f} value={card.attributes?.[f.key]} nameMap={nameMap} />
                ))}
              </>
            ))}
          </div>

        <ActivitySection boardId={boardId!} cardId={cardId!} />
        {isDirty && <div style={{ height: 52 }} />}
      </div>
    </div>

    {isDirty && (
      <div className="unsaved-bar">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#60a5fa', fontSize: 15 }}>✎</span>
          {isCardDirty && (commentDraft.trim() || commentEditDirty)
            ? 'Unsaved card changes and a comment.'
            : isCardDirty
              ? 'This card has unsaved changes.'
              : commentEditDirty
                ? 'You have unsaved changes to a comment.'
                : 'You have an unsaved comment draft.'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {isCardDirty && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => saveMutation.mutate()}
              disabled={!editTitle.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#94a3b8' }}
            onClick={() => {
              if (isCardDirty) resetEdit()
              setCommentDraft('')
              if (commentEditDirty) setCommentEditCancelSeq((s) => s + 1)
            }}
          >
            Discard
          </button>
        </div>
      </div>
    )}

    {descFullscreen && (
      <div className="md-fullscreen-overlay">
        <div className="md-fullscreen-header">
          <span className="md-fullscreen-title">
            Description{descDirty && <span style={{ marginLeft: 6, color: '#3b82f6', fontWeight: 400 }}>✎</span>}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setDescFullscreen(false)}
          >
            Done
          </button>
        </div>
        <MarkdownEditor
          value={editDescription}
          onChange={setEditDescription}
          rows={20}
          placeholder="Description…"
        />
      </div>
    )}

    {confirm && (
      <ConfirmDialog
        message={confirm.message}
        detail={confirm.detail}
        danger={confirm.danger}
        confirmLabel={confirm.confirmLabel}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}

    {blocker.state === 'blocked' && (
      <ConfirmDialog
        message="Discard changes?"
        detail="You have unsaved changes. Leaving this page will discard them."
        confirmLabel="Leave"
        danger
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    )}
    </>
  )
}
