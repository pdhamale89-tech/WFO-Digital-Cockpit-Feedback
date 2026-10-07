import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({ title, description, icon: Icon = Inbox, action }: {
  title: string; description?: string; icon?: LucideIcon; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-subtle"><Icon className="h-6 w-6" aria-hidden="true" /></div>
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-600 dark:bg-red-950"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></div>
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 max-w-sm text-subtle">{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm mt-4" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />
}

/** Skeleton placeholders: `kpi`, `table`, `drawer`, `chart`, or a centered `spinner`. */
export function LoadingState({ variant = 'spinner', rows = 8 }: { variant?: 'spinner' | 'kpi' | 'table' | 'drawer' | 'chart'; rows?: number }) {
  if (variant === 'kpi') {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" role="status" aria-label="Loading metrics">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="card space-y-3 p-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-14" /></div>)}
      </div>
    )
  }
  if (variant === 'table') {
    return (
      <div className="space-y-2 p-4" role="status" aria-label="Loading feedback">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9" />)}
      </div>
    )
  }
  if (variant === 'drawer') {
    return (
      <div className="space-y-4 p-5" role="status" aria-label="Loading details">
        <Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-28" />
        <Skeleton className="h-48" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/4" />
      </div>
    )
  }
  if (variant === 'chart') {
    return <div className="card p-4" role="status" aria-label="Loading chart"><Skeleton className="mb-4 h-4 w-32" /><Skeleton className="h-56" /></div>
  }
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-subtle" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading…
    </div>
  )
}
