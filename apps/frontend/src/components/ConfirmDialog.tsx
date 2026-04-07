interface Props {
  message: string
  detail?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  message,
  detail,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 200 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <span className="modal-title">{message}</span>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        {detail && (
          <div className="modal-body" style={{ fontSize: 13, color: '#475569' }}>
            {detail}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
