import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { getCard, updateCard, deleteCard, getColumns } from '@/lib/api'
import { useUiStore } from '@/store/uiStore'

function TypeBadge({ type }: { type: string }) {
  return <span className={`badge badge-${type}`}>{type}</span>
}

export default function CardDetail() {
  const { id: boardId, cardId } = useParams<{ id: string; cardId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setBoardName = useUiStore((s) => s.setBoardName)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

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

  useEffect(() => {
    if (card) {
      setEditTitle(card.title)
      setEditDescription(card.description ?? '')
    }
  }, [card])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCard(boardId!, cardId!, {
        title: editTitle.trim() || undefined,
        description: editDescription || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', boardId, cardId] })
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
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

  if (isLoading) return <div className="loading-center">Loading card…</div>
  if (!card) return <div className="loading-center">Card not found.</div>

  return (
    <div className="detail-layout">
      <div className="detail-main">
        <div className="detail-topbar">
          <Link to={`/boards/${boardId}`} className="btn btn-ghost btn-sm">
            ← Back
          </Link>
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
                rows={10}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
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
                <p className="text-muted" style={{ fontSize: 13 }}>No description. Click Edit to add one.</p>
              </div>
            )}
          </>
        )}
      </div>

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
            <span className="sidebar-field-value">
              {new Date(card.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="sidebar-field">
            <span className="sidebar-field-label">Updated</span>
            <span className="sidebar-field-value">
              {new Date(card.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {Object.keys(card.attributes ?? {}).length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Attributes</div>
            {Object.entries(card.attributes).map(([k, v]) => (
              <div key={k} className="sidebar-field">
                <span className="sidebar-field-label">{k}</span>
                <span className="sidebar-field-value">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
