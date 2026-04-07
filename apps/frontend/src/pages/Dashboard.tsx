import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Board } from '@flexboard/shared'
import { useUiStore } from '@/store/uiStore'
import { getUser } from '@/lib/auth'
import { getBoards, createBoard } from '@/lib/api'

const ACCENT_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#dc2626', '#0891b2']

function accentFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ACCENT_COLORS[h % ACCENT_COLORS.length]
}

function NewBoardModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => createBoard({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (board) => {
      qc.invalidateQueries({ queryKey: ['boards'] })
      onClose()
      navigate(`/boards/${board.id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">New Board</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">
                Name <span className="form-label-req">*</span>
              </label>
              <input
                className="form-input"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Product Roadmap"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={3}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!name.trim() || mutation.isPending}
            >
              {mutation.isPending ? 'Creating…' : 'Create board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BoardGrid({ boards, showNew, onNew }: { boards: Board[]; showNew?: boolean; onNew?: () => void }) {
  return (
    <div className="boards-grid">
      {boards.map((board) => (
        <Link key={board.id} to={`/boards/${board.id}`} className="board-tile">
          <div className="board-tile-accent" style={{ background: accentFor(board.id) }} />
          <div className="board-tile-body">
            <div className="board-tile-title">{board.name}</div>
            {board.description && (
              <div className="board-tile-meta">{board.description}</div>
            )}
          </div>
        </Link>
      ))}
      {showNew && onNew && (
        <button className="board-tile-new" onClick={onNew}>
          <span className="board-tile-new-icon">+</span>
          New board
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [currentUserSub, setCurrentUserSub] = useState<string | null>(null)
  const setBoardCrumb = useUiStore((s) => s.setBoardCrumb)

  useEffect(() => { setBoardCrumb(null, null) }, [setBoardCrumb])
  useEffect(() => { getUser().then((u) => setCurrentUserSub(u?.profile.sub ?? null)) }, [])

  const { data: boards, isLoading, error } = useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
  })

  if (isLoading) return <div className="loading-center">Loading boards…</div>
  if (error) return <div className="loading-center" style={{ color: '#dc2626' }}>Failed to load boards.</div>

  const myBoards = boards?.filter((b) =>
    b.members.some((m) => m.userId === currentUserSub && m.role === 'owner'),
  ) ?? []
  const sharedBoards = boards?.filter((b) =>
    b.members.some((m) => m.userId === currentUserSub && m.role !== 'owner'),
  ) ?? []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Boards</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewBoard(true)}>
          + New Board
        </button>
      </div>

      <BoardGrid boards={myBoards} showNew onNew={() => setShowNewBoard(true)} />

      {sharedBoards.length > 0 && (
        <>
          <div className="page-section-title">Shared With Me</div>
          <BoardGrid boards={sharedBoards} />
        </>
      )}

      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} />}
    </div>
  )
}
