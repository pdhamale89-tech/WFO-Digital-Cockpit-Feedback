import { ArrowRight, History } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { FeedbackHistoryEntry } from '@/types'
import { EmptyState } from './States'

const FIELD_LABEL: Record<string, string> = {
  status: 'Status', owner: 'Owner', priority: 'Priority', resolution: 'Resolution', admin_comments: 'Admin comments',
  card_graph_name: 'Component name', feedback_type: 'Feedback type', changes_required: 'Changes required', user_comments: 'User comment',
}

const show = (v: string | null) => (v === null || v === '' ? '—' : v.length > 120 ? `${v.slice(0, 120)}…` : v)

export function AuditTimeline({ entries }: { entries: FeedbackHistoryEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={History} title="No changes recorded yet" description="Status, owner, priority and comment changes will appear here." />
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((e) => (
        <li key={e.history_id} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" aria-hidden="true" />
          <p className="text-xs text-subtle">
            {formatDateTime(e.changed_at)} · {e.changer?.name || e.changer?.email || 'System'}
          </p>
          <p className="mt-0.5">
            <span className="font-semibold">{FIELD_LABEL[e.field_changed] ?? e.field_changed}</span>
            <span className="mx-1.5 inline-flex items-center gap-1.5 text-subtle">
              <span className="break-words line-through decoration-subtle/50">{show(e.old_value)}</span>
              <ArrowRight className="h-3 w-3 shrink-0" aria-label="changed to" />
              <span className="break-words font-medium text-fg">{show(e.new_value)}</span>
            </span>
          </p>
        </li>
      ))}
    </ol>
  )
}
