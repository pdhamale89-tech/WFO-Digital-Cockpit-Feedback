import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'error' | 'info'
export interface ToastItem { id: number; kind: ToastKind; title: string; description?: string }

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info }
const TONE = {
  success: 'border-green-400 text-green-700 dark:text-green-300',
  error: 'border-red-400 text-red-700 dark:text-red-300',
  info: 'border-brand text-brand',
}

export function ToastNotification({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const Icon = ICON[t.kind]
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex gap-3 rounded-lg border-l-4 border border-border bg-surface p-3 shadow-lg', TONE[t.kind])}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-fg">
              <p className="font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-subtle">{t.description}</p>}
            </div>
            <button className="h-6 w-6 shrink-0 rounded text-subtle hover:bg-muted" onClick={() => onDismiss(t.id)} aria-label="Dismiss notification">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
