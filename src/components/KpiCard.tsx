import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function KpiCard({ label, value, icon: Icon, tone = 'default', hint }: {
  label: string; value: string | number; icon: LucideIcon; hint?: string
  tone?: 'default' | 'warn' | 'danger' | 'success'
}) {
  const toneCls = {
    default: 'bg-brand-soft text-brand',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  }[tone]
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={cn('rounded-lg p-2.5', toneCls)}><Icon className="h-5 w-5" aria-hidden="true" /></div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
        {hint && <p className="truncate text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  )
}
