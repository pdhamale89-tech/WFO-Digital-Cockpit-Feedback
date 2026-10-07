import { Loader2 } from 'lucide-react'
import { Overlay } from './Overlay'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }: Props) {
  return (
    <Overlay open={open} onClose={busy ? () => undefined : onCancel} label={title}>
      <div className="p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-subtle">{message}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-3">
        <button className="btn-secondary" onClick={onCancel} disabled={busy} data-autofocus>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  )
}
