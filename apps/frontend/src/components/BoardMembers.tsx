import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserRole } from '@flexboard/shared'
import { getMembers, addMember, updateMember, removeMember, searchUsers } from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Props {
  boardId: string
  currentUserSub: string
  onClose: () => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

interface UserResult {
  sub: string
  email: string
  name: string
}

function UserCombobox({
  excludeSubs,
  value,
  onChange,
}: {
  excludeSubs: string[]
  value: UserResult | null
  onChange: (user: UserResult | null) => void
}) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const [debounced, setDebounced] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce: update search term 300 ms after typing stops
  useEffect(() => {
    const id = setTimeout(() => setDebounced(inputValue.trim()), 300)
    return () => clearTimeout(id)
  }, [inputValue])

  const { data: results = [] } = useQuery({
    queryKey: ['user-search', debounced],
    queryFn: () => searchUsers(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  const filtered = results.filter((u) => !excludeSubs.includes(u.sub))

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setOpen(true)
    // Clear any previously confirmed selection if the user edits the field
    if (value) onChange(null)
  }

  const handleSelect = (user: UserResult) => {
    onChange(user)
    setInputValue(user.email)
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setInputValue('')
    setOpen(false)
  }

  const showDropdown = open && debounced.length >= 2

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search by email…"
          value={inputValue}
          onChange={handleInput}
          onFocus={() => { if (debounced.length >= 2) setOpen(true) }}
          style={{ fontSize: 13, paddingRight: value ? 28 : undefined }}
          autoComplete="off"
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

      {value && (
        <div style={{
          marginTop: 4, padding: '6px 10px',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontWeight: 500, color: '#1d4ed8' }}>{value.name}</span>
          <span style={{ color: '#64748b' }}>{value.email}</span>
        </div>
      )}

      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.1)', marginTop: 2,
          maxHeight: 200, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 13 }}>
              No matching users found
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.sub}
                type="button"
                onMouseDown={() => handleSelect(u)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ fontWeight: 500 }}>{u.name}</div>
                <div style={{ color: '#64748b', fontSize: 12 }}>{u.email}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function BoardMembers({ boardId, currentUserSub, onClose }: Props) {
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null)
  const qc = useQueryClient()

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', boardId],
    queryFn: () => getMembers(boardId),
  })

  const currentMember = members?.find((m) => m.userId === currentUserSub)
  const isOwner = currentMember?.role === 'owner'
  const memberSubs = members?.map((m) => m.userId) ?? []

  const inviteMutation = useMutation({
    mutationFn: () => addMember(boardId, { email: selectedUser!.email, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', boardId] })
      setSelectedUser(null)
      setInviteError(null)
    },
    onError: (err: Error) => setInviteError(err.message),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateMember(boardId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', boardId] }),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(boardId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', boardId] }),
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setInviteError(null)
    inviteMutation.mutate()
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Board Members</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '12px 20px' }}>
          {isLoading ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {members?.map((m) => (
                  <tr key={m.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{m.email}</div>
                    </td>
                    <td style={{ padding: '8px 16px 8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isOwner && m.userId !== currentUserSub ? (
                        <select
                          className="form-select"
                          value={m.role}
                          style={{ fontSize: 12, padding: '3px 6px', marginRight: 6 }}
                          onChange={(e) =>
                            roleMutation.mutate({ userId: m.userId, role: e.target.value as UserRole })
                          }
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span style={{ color: '#64748b', marginRight: 12 }}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      )}
                      {isOwner && m.userId !== currentUserSub && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#dc2626', padding: '2px 6px' }}
                          onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })}
                          title="Remove member"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {isOwner && (
            <form onSubmit={handleInvite} style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Invite a member</div>

              <div className="form-group">
                <label className="form-label">User</label>
                <UserCombobox
                  excludeSubs={memberSubs}
                  value={selectedUser}
                  onChange={setSelectedUser}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  style={{ fontSize: 13 }}
                >
                  <option value="editor">Editor — can create and edit cards</option>
                  <option value="viewer">Viewer — read-only access</option>
                </select>
              </div>

              {inviteError && (
                <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{inviteError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!selectedUser || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Inviting…' : 'Send invite'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          message="Remove member?"
          detail={`${confirmRemove.name} will lose access to this board.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => { removeMutation.mutate(confirmRemove.userId); setConfirmRemove(null) }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  )
}
