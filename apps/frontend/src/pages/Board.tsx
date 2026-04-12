import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card, Column } from '@flexboard/shared'
import {
  getBoard,
  getColumns,
  getCards,
  getMembers,
  createColumn,
  createCard,
  updateCard,
  updateBoard,
  updateColumn,
  deleteColumn,
  deleteBoard,
} from '@/lib/api'
import { getUser } from '@/lib/auth'
import { remarkPlugins, rehypePlugins } from '@/lib/markdown'
import { useUiStore } from '@/store/uiStore'
import { useBoardSSE } from '@/hooks/useBoardSSE'
import BoardMembers from '@/components/BoardMembers'
import ConfirmDialog from '@/components/ConfirmDialog'

// ── Helpers ───────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return <span className={`badge badge-${type}`}>{type}</span>
}

const AVATAR_COLORS = ['av-blue', 'av-purple', 'av-green', 'av-orange', 'av-red']
function avatarColor(sub: string): string {
  let h = 0
  for (let i = 0; i < sub.length; i++) h = (h * 31 + sub.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Card Item ─────────────────────────────────────────────

interface KCardProps {
  card: Card
  boardId: string
  nameMap: Map<string, string>
}

function KCard({ card, boardId, nameMap }: KCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId, card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const assigneeSub = typeof card.attributes?.assignee === 'string' ? card.attributes.assignee : null
  const assigneeName = assigneeSub ? (nameMap.get(assigneeSub) ?? assigneeSub) : null
  const priority = typeof card.attributes?.priority === 'string' ? card.attributes.priority : null
  const labels: string[] = Array.isArray(card.attributes?.labels)
    ? (card.attributes.labels as string[])
    : typeof card.attributes?.labels === 'string'
    ? (card.attributes.labels as string).split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const shortId = card.id.slice(-5)
  const hasFooter = labels.length > 0 || priority || assigneeName

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kcard"
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/boards/${boardId}/cards/${card.id}`)}
    >
      <div className="kcard-top">
        <TypeBadge type={card.type} />
        <span className="kcard-id" style={{ marginLeft: 'auto' }}>#{shortId}</span>
      </div>
      <div className="kcard-title">{card.title}</div>
      {hasFooter && (
        <div className="kcard-footer">
          {labels.map((tag) => (
            <span key={tag} className="label-tag">{tag}</span>
          ))}
          {priority && (
            <span className={`prio-dot prio-${priority}`} title={priority} />
          )}
          {assigneeName && (
            <span
              className={`avatar avatar-sm ${avatarColor(assigneeSub!)}`}
              title={assigneeName}
              style={{ marginLeft: 'auto' }}
            >
              {nameInitials(assigneeName)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function CardOverlay({ card }: { card: Card }) {
  const priority = typeof card.attributes?.priority === 'string' ? card.attributes.priority : null
  const labels: string[] = Array.isArray(card.attributes?.labels)
    ? (card.attributes.labels as string[])
    : []
  const hasFooter = labels.length > 0 || priority

  return (
    <div className="kcard" style={{ boxShadow: '0 8px 24px rgba(0,0,0,.15)', cursor: 'grabbing' }}>
      <div className="kcard-top">
        <TypeBadge type={card.type} />
        <span className="kcard-id">#{card.id.slice(-5)}</span>
      </div>
      <div className="kcard-title">{card.title}</div>
      {hasFooter && (
        <div className="kcard-footer">
          {labels.map((tag) => <span key={tag} className="label-tag">{tag}</span>)}
          {priority && <span className={`prio-dot prio-${priority}`} title={priority} />}
        </div>
      )}
    </div>
  )
}

// ── Add Card Modal ────────────────────────────────────────

interface AddCardModalProps {
  boardId: string
  columns: Column[]
  onClose: () => void
  onCreated: (card: Card) => void
}

function AddCardModal({ boardId, columns, onClose, onCreated }: AddCardModalProps) {
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '')
  const [type, setType] = useState('task')
  const [title, setTitle] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createCard(boardId, { columnId, type, title: title.trim() }),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
      onCreated(card)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !columnId) return
    mutation.mutate()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add Card</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Column <span className="form-label-req">*</span></label>
              <select
                className="form-select"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type <span className="form-label-req">*</span></label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="story">Story</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Title <span className="form-label-req">*</span></label>
              <input
                className="form-input"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title…"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!title.trim() || !columnId || mutation.isPending}
            >
              {mutation.isPending ? 'Adding…' : 'Add card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────

interface KColumnProps {
  col: Column
  cards: Card[]
  boardId: string
  nameMap: Map<string, string>
  editMode?: boolean
  isFirst?: boolean
  isLast?: boolean
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onDelete?: () => void
}

function KColumn({ col, cards, boardId, nameMap, editMode, isFirst, isLast, onMoveLeft, onMoveRight, onDelete }: KColumnProps) {
  const cardIds = cards.map((c) => c.id)

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className={`kanban-col${isOver ? ' drag-over' : ''}`}>
      <div className="kanban-col-header">
        <div className="kanban-col-title">
          {col.name}
          <span className="col-count">{cards.length}</span>
        </div>
        {editMode && (
          <div className="col-edit-controls">
            <button
              className="col-edit-btn"
              onClick={onMoveLeft}
              disabled={isFirst}
              title="Move left"
            >←</button>
            <button
              className="col-edit-btn"
              onClick={onMoveRight}
              disabled={isLast}
              title="Move right"
            >→</button>
            <button
              className="col-edit-btn danger"
              onClick={onDelete}
              title="Delete column"
            >✕</button>
          </div>
        )}
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy} id={col.id}>
        <div ref={setDropRef} className="kanban-col-body" data-column-id={col.id}>
          {cards.map((card) => (
            <KCard key={card.id} card={card} boardId={boardId} nameMap={nameMap} />
          ))}
        </div>
      </SortableContext>

    </div>
  )
}

// ── Add Column Modal ──────────────────────────────────────

function AddColumnModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createColumn(boardId, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns', boardId] })
      onClose()
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
          <span className="modal-title">Add Column</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Column name <span className="form-label-req">*</span></label>
              <input
                className="form-input"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. In Progress"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Board Page ────────────────────────────────────────────

export default function Board() {
  const { id: boardId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editMode, setEditMode] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddCol, setShowAddCol] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showEditOverflow, setShowEditOverflow] = useState(false)
  const [confirm, setConfirm] = useState<{
    message: string; detail?: string; confirmLabel?: string; onConfirm: () => void
  } | null>(null)
  const [descEditing, setDescEditing] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [editBoardName, setEditBoardName] = useState('')
  const [currentUserSub, setCurrentUserSub] = useState<string | null>(null)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [localCards, setLocalCards] = useState<Card[] | null>(null)
  const [activeColIndex, setActiveColIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  )

  const dragSourceColId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const setBoardCrumb = useUiStore((s) => s.setBoardCrumb)
  const qc = useQueryClient()

  useEffect(() => {
    getUser().then((u) => setCurrentUserSub(u?.profile.sub ?? null))
  }, [])

  // Track mobile breakpoint for sensor tuning
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId!),
    enabled: !!boardId,
  })

  const { data: columns } = useQuery({
    queryKey: ['columns', boardId],
    queryFn: () => getColumns(boardId!),
    enabled: !!boardId,
  })

  const { data: cards, isLoading } = useQuery({
    queryKey: ['cards', boardId],
    queryFn: () => getCards(boardId!),
    enabled: !!boardId,
  })

  const { data: members } = useQuery({
    queryKey: ['members', boardId],
    queryFn: () => getMembers(boardId!),
    enabled: !!boardId,
  })

  const nameMap = new Map(members?.map((m) => [m.userId, m.name]) ?? [])
  const isOwner = !!(currentUserSub && members?.find((m) => m.userId === currentUserSub)?.role === 'owner')

  useEffect(() => {
    setBoardCrumb(boardId ?? null, board?.name ?? null)
    return () => setBoardCrumb(null, null)
  }, [boardId, board?.name, setBoardCrumb])

  useBoardSSE(boardId)

  useEffect(() => {
    if (cards) setLocalCards(cards)
  }, [cards])

  // Sorted columns — computed before early return so the IntersectionObserver
  // effect can reference it as a dependency.
  const sortedColumns = (columns ?? []).slice().sort((a, b) => a.position - b.position)

  // IntersectionObserver for mobile column indicator dots
  useEffect(() => {
    const container = scrollRef.current
    if (!container || sortedColumns.length === 0) return

    const colEls = container.querySelectorAll('.kanban-col')
    if (colEls.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.5) {
            const idx = Array.from(colEls).indexOf(entry.target as Element)
            if (idx !== -1) setActiveColIndex(idx)
          }
        }
      },
      { root: container, threshold: 0.5 },
    )

    colEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sortedColumns.length])

  const moveMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: { columnId?: string; position?: number } }) =>
      updateCard(boardId!, cardId, data),
    onError: () => qc.invalidateQueries({ queryKey: ['cards', boardId] }),
  })

  const moveColumnMutation = useMutation({
    mutationFn: ({ colId, swapColId, posA, posB }: {
      colId: string; swapColId: string; posA: number; posB: number
    }) => Promise.all([
      updateColumn(boardId!, colId, { position: posB }),
      updateColumn(boardId!, swapColId, { position: posA }),
    ]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', boardId] }),
  })

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: string) => deleteColumn(boardId!, colId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns', boardId] })
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
    },
  })

  const deleteBoardMutation = useMutation({
    mutationFn: () => deleteBoard(boardId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
      navigate('/')
    },
  })

  const updateBoardDescMutation = useMutation({
    mutationFn: (description: string) => updateBoard(boardId!, { description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
      setDescEditing(false)
    },
  })

  const updateBoardNameMutation = useMutation({
    mutationFn: (name: string) => updateBoard(boardId!, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', boardId] }),
  })

  const handleEnterEditMode = () => {
    setEditBoardName(board?.name ?? '')
    setEditMode(true)
  }

  const handleBoardNameBlur = () => {
    const trimmed = editBoardName.trim()
    if (!trimmed) {
      setEditBoardName(board?.name ?? '')
      return
    }
    if (trimmed !== board?.name) {
      updateBoardNameMutation.mutate(trimmed)
    }
  }

  // Touch: delay+tolerance prevents scroll-swipe from triggering a drag.
  // Mouse: distance-only for snappy desktop feel.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 200, tolerance: 8 }
        : { distance: 5 },
    }),
  )

  const displayCards = localCards ?? cards ?? []

  const cardsForColumn = (colId: string) =>
    displayCards.filter((c) => c.columnId === colId).sort((a, b) => a.position - b.position)

  const handleDeleteColumn = (col: Column) => {
    const count = cardsForColumn(col.id).length
    setConfirm({
      message: `Delete column "${col.name}"?`,
      detail: count > 0
        ? `This will permanently delete ${count} card${count !== 1 ? 's' : ''}.`
        : 'This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => { deleteColumnMutation.mutate(col.id); setConfirm(null) },
    })
  }

  const handleDeleteBoard = () => {
    setConfirm({
      message: `Delete board "${board?.name}"?`,
      detail: 'All columns and cards will be permanently deleted. This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => { deleteBoardMutation.mutate(); setConfirm(null) },
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = displayCards.find((c) => c.id === event.active.id)
    setActiveCard(card ?? null)
    dragSourceColId.current = card?.columnId ?? null
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeCard = displayCards.find((c) => c.id === active.id)
    if (!activeCard) return

    const overCard = displayCards.find((c) => c.id === over.id)
    const targetColId = overCard ? overCard.columnId : (over.id as string)

    if (activeCard.columnId !== targetColId) {
      setLocalCards((prev) =>
        (prev ?? []).map((c) => (c.id === activeCard.id ? { ...c, columnId: targetColId } : c)),
      )
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    const sourceColId = dragSourceColId.current
    dragSourceColId.current = null
    if (!over || !sourceColId) return

    const cardId = active.id as string
    const overCard = displayCards.find((c) => c.id === over.id)
    const targetColId = overCard ? overCard.columnId : (over.id as string)

    const isCrossColumn = sourceColId !== targetColId

    if (isCrossColumn) {
      moveMutation.mutate({ cardId, data: { columnId: targetColId } })
    } else if (over.id !== active.id) {
      const colCards = (localCards ?? [])
        .filter((c) => c.columnId === targetColId)
        .sort((a, b) => a.position - b.position)
      const oldIdx = colCards.findIndex((c) => c.id === active.id)
      const newIdx = colCards.findIndex((c) => c.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(colCards, oldIdx, newIdx)
        const updates = reordered.map((c, i) => ({ ...c, position: i }))
        setLocalCards((prev) =>
          (prev ?? []).map((c) => updates.find((u) => u.id === c.id) ?? c),
        )
        moveMutation.mutate({ cardId, data: { position: updates.find((c) => c.id === cardId)!.position } })
      }
    }
  }

  // Scroll to a column when a dot is tapped
  const scrollToColumn = (idx: number) => {
    const container = scrollRef.current
    if (!container) return
    const col = container.querySelectorAll('.kanban-col')[idx] as HTMLElement | undefined
    col?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  if (isLoading) return <div className="loading-center">Loading board…</div>

  return (
    <>
      <div className="board-toolbar">
        {editMode ? (
          <input
            className="board-name-input"
            value={editBoardName}
            onChange={(e) => setEditBoardName(e.target.value)}
            onBlur={handleBoardNameBlur}
            placeholder="Board name…"
            aria-label="Board name"
          />
        ) : (
          <span className="board-toolbar-title">{board?.name}</span>
        )}
        <div style={{ flex: 1 }} />
        {!editMode && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddCard(true)}
            disabled={sortedColumns.length === 0}
          >
            + Add card
          </button>
        )}
        {editMode ? (
          <>
            <div className="board-overflow-wrap">
              <button
                className="btn btn-secondary btn-sm board-overflow-btn"
                onClick={() => setShowEditOverflow((o) => !o)}
                aria-label="More actions"
              >
                ⋯
              </button>
              {showEditOverflow && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 299 }}
                    onClick={() => setShowEditOverflow(false)}
                  />
                  <div className="board-overflow-menu">
                    <button
                      className="board-overflow-item"
                      onClick={() => { setShowEditOverflow(false); setShowMembers(true) }}
                    >
                      Members
                    </button>
                    <button
                      className="board-overflow-item danger"
                      onClick={() => { setShowEditOverflow(false); handleDeleteBoard() }}
                    >
                      Delete board
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>
              Done
            </button>
          </>
        ) : isOwner && (
          <button className="btn btn-secondary btn-sm" onClick={handleEnterEditMode}>
            Edit board
          </button>
        )}
      </div>

      {(board?.description || isOwner) && (
        <div className="board-desc">
          {descEditing ? (
            <>
              <textarea
                className="board-desc-textarea"
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="Board description (Markdown supported)…"
                rows={4}
              />
              <div className="board-desc-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => updateBoardDescMutation.mutate(descValue)}
                  disabled={updateBoardDescMutation.isPending}
                >
                  {updateBoardDescMutation.isPending ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDescEditing(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : board?.description ? (
            <>
              <div className="prose board-desc-content">
                <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
                  {board.description}
                </ReactMarkdown>
              </div>
              {isOwner && (
                <button
                  className="board-desc-edit-btn"
                  title="Edit description"
                  onClick={() => { setDescValue(board.description ?? ''); setDescEditing(true) }}
                >
                  ✎
                </button>
              )}
            </>
          ) : (
            <button
              className="board-desc-placeholder"
              onClick={() => { setDescValue(''); setDescEditing(true) }}
            >
              Add a description…
            </button>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-wrap" ref={scrollRef}>
          {sortedColumns.map((col, idx) => (
            <KColumn
              key={col.id}
              col={col}
              cards={cardsForColumn(col.id)}
              boardId={boardId!}
              nameMap={nameMap}
              editMode={editMode}
              isFirst={idx === 0}
              isLast={idx === sortedColumns.length - 1}
              onMoveLeft={() => {
                const prev = sortedColumns[idx - 1]
                if (prev) moveColumnMutation.mutate({ colId: col.id, swapColId: prev.id, posA: col.position, posB: prev.position })
              }}
              onMoveRight={() => {
                const next = sortedColumns[idx + 1]
                if (next) moveColumnMutation.mutate({ colId: col.id, swapColId: next.id, posA: col.position, posB: next.position })
              }}
              onDelete={() => handleDeleteColumn(col)}
            />
          ))}

          {editMode && (
            <button className="kanban-add-col" onClick={() => setShowAddCol(true)}>
              + Add column
            </button>
          )}
        </div>

        <DragOverlay>
          {activeCard ? <CardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Column indicator dots — hidden on desktop via CSS */}
      {sortedColumns.length > 1 && (
        <div className="kanban-dots">
          {sortedColumns.map((col, i) => (
            <button
              key={col.id}
              className={`kanban-dot${i === activeColIndex ? ' active' : ''}`}
              onClick={() => scrollToColumn(i)}
              aria-label={`Go to column ${col.name}`}
            />
          ))}
        </div>
      )}

      {showAddCard && (
        <AddCardModal
          boardId={boardId!}
          columns={sortedColumns}
          onClose={() => setShowAddCard(false)}
          onCreated={(card) => navigate(`/boards/${boardId}/cards/${card.id}`, { state: { startEdit: true } })}
        />
      )}
      {showAddCol && <AddColumnModal boardId={boardId!} onClose={() => setShowAddCol(false)} />}
      {showMembers && currentUserSub && (
        <BoardMembers
          boardId={boardId!}
          currentUserSub={currentUserSub}
          onClose={() => setShowMembers(false)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          detail={confirm.detail}
          confirmLabel={confirm.confirmLabel}
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )
}
