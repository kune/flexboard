import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUiStore } from '@/store/uiStore'
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

export default function Dashboard() {
  const [showNewBoard, setShowNewBoard] = useState(false)
  const setBoardName = useUiStore((s) => s.setBoardName)

  useEffect(() => { setBoardName(null) }, [setBoardName])

  const { data: boards, isLoading, error } = useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
  })

  if (isLoading) return <div className="loading-center">Loading boards…</div>
  if (error) return <div className="loading-center" style={{ color: '#dc2626' }}>Failed to load boards.</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Boards</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewBoard(true)}>
          + New Board
        </button>
      </div>

      <div className="boards-grid">
        {boards?.map((board) => (
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

        <button className="board-tile-new" onClick={() => setShowNewBoard(true)}>
          <span className="board-tile-new-icon">+</span>
          New board
        </button>
      </div>

      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} />}
    </div>
  )
}
