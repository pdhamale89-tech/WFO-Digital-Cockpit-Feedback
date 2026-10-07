import { Ban, CheckCircle2, CircleDot, Eye, Loader2, OctagonAlert, type LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, Equal, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Priority, Status } from '@/types'

const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold'

const STATUS_STYLE: Record<Status, { cls: string; icon: LucideIcon }> = {
  New: { cls: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200', icon: CircleDot },
  'Under Review': { cls: 'border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200', icon: Eye },
  'In Progress': { cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200', icon: Loader2 },
  Blocked: { cls: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200', icon: OctagonAlert },
  Completed: { cls: 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200', icon: CheckCircle2 },
  Rejected: { cls: 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300', icon: Ban },
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.New
  const Icon = s.icon
  return (
    <span className={cn(base, s.cls, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {status}
    </span>
  )
}

const PRIORITY_STYLE: Record<Priority, { cls: string; icon: LucideIcon }> = {
  Critical: { cls: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200', icon: Flame },
  High: { cls: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200', icon: ArrowUp },
  Medium: { cls: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200', icon: Equal },
  Low: { cls: 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300', icon: ArrowDown },
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.Medium
  const Icon = s.icon
  return (
    <span className={cn(base, s.cls, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {priority}
    </span>
  )
}
