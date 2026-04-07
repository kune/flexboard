import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
} from '@/lib/api'
import { getUser } from '@/lib/auth'
import { useUiStore } from '@/store/uiStore'
import { useBoardSSE } from '@/hooks/useBoardSSE'
import BoardMembers from '@/components/BoardMembers'

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

// ── Add Card Form ─────────────────────────────────────────

interface AddCardFormProps {
  boardId: string
  columnId: string
  onDone: () => void
}

function AddCardForm({ boardId, columnId, onDone }: AddCardFormProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('task')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createCard(boardId, { columnId, type, title: title.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards', boardId] })
      onDone()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    mutation.mutate()
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ margin: '0 10px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}
    >
      <select
        className="form-select"
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ marginBottom: 8, fontSize: 12, padding: '4px 8px' }}
      >
        <option value="task">Task</option>
        <option value="bug">Bug</option>
        <option value="story">Story</option>
        <option value="epic">Epic</option>
      </select>
      <input
        className="form-input"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title…"
        style={{ marginBottom: 8, fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim() || mutation.isPending}>
          Add
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Column ────────────────────────────────────────────────

interface KColumnProps {
  col: Column
  cards: Card[]
  boardId: string
  nameMap: Map<string, string>
}

function KColumn({ col, cards, boardId, nameMap }: KColumnProps) {
  const [addingCard, setAddingCard] = useState(false)
  const cardIds = cards.map((c) => c.id)

  // Register the column body as a droppable so empty columns accept drops
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className={`kanban-col${isOver ? ' drag-over' : ''}`}>
      <div className="kanban-col-header">
        <div className="kanban-col-title">
          {col.name}
          <span className="col-count">{cards.length}</span>
        </div>
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy} id={col.id}>
        <div ref={setDropRef} className="kanban-col-body" data-column-id={col.id}>
          {cards.map((card) => (
            <KCard key={card.id} card={card} boardId={boardId} nameMap={nameMap} />
          ))}
        </div>
      </SortableContext>

      {addingCard ? (
        <AddCardForm boardId={boardId} columnId={col.id} onDone={() => setAddingCard(false)} />
      ) : (
        <button className="kanban-add-btn" onClick={() => setAddingCard(true)}>
          + Add card
        </button>
      )}
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
  const [showAddCol, setShowAddCol] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [currentUserSub, setCurrentUserSub] = useState<string | null>(null)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [localCards, setLocalCards] = useState<Card[] | null>(null)
  // Track the column the card started in — handleDragOver mutates localCards before
  // handleDragEnd runs, so we can't read movedCard.columnId there to detect cross-column moves.
  const dragSourceColId = useRef<string | null>(null)
  const setBoardCrumb = useUiStore((s) => s.setBoardCrumb)
  const qc = useQueryClient()

  useEffect(() => {
    getUser().then((u) => setCurrentUserSub(u?.profile.sub ?? null))
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

  useEffect(() => {
    setBoardCrumb(boardId ?? null, board?.name ?? null)
    return () => setBoardCrumb(null, null)
  }, [boardId, board?.name, setBoardCrumb])

  useBoardSSE(boardId)

  // Keep local copy for optimistic dnd updates
  useEffect(() => {
    if (cards) setLocalCards(cards)
  }, [cards])

  const moveMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: { columnId?: string; position?: number } }) =>
      updateCard(boardId!, cardId, data),
    onError: () => qc.invalidateQueries({ queryKey: ['cards', boardId] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const displayCards = localCards ?? cards ?? []

  const cardsForColumn = (colId: string) =>
    displayCards.filter((c) => c.columnId === colId).sort((a, b) => a.position - b.position)

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

    // over.id is either a card id or a column id (from the useDroppable column body)
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

    // Use server cards (not localCards) to get the card's identity — localCards may already
    // have the updated columnId from handleDragOver, making cross-column detection impossible.
    const cardId = active.id as string
    const overCard = displayCards.find((c) => c.id === over.id)
    const targetColId = overCard ? overCard.columnId : (over.id as string)

    const isCrossColumn = sourceColId !== targetColId

    if (isCrossColumn) {
      moveMutation.mutate({ cardId, data: { columnId: targetColId } })
    } else if (over.id !== active.id) {
      // Same-column reorder
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

  if (isLoading) return <div className="loading-center">Loading board…</div>

  const sortedColumns = (columns ?? []).slice().sort((a, b) => a.position - b.position)

  return (
    <>
      <div className="board-toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => setShowMembers(true)}>
          Members
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-wrap">
          {sortedColumns.map((col) => (
            <KColumn
              key={col.id}
              col={col}
              cards={cardsForColumn(col.id)}
              boardId={boardId!}
              nameMap={nameMap}
            />
          ))}

          <button className="kanban-add-col" onClick={() => setShowAddCol(true)}>
            + Add column
          </button>
        </div>

        <DragOverlay>
          {activeCard ? <CardOverlay card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {showAddCol && <AddColumnModal boardId={boardId!} onClose={() => setShowAddCol(false)} />}
      {showMembers && currentUserSub && (
        <BoardMembers
          boardId={boardId!}
          currentUserSub={currentUserSub}
          onClose={() => setShowMembers(false)}
        />
      )}
    </>
  )
}
