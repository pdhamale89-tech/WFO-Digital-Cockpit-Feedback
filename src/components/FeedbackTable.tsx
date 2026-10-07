import { useMemo, useState } from 'react'
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Image as ImageIcon } from 'lucide-react'
import { PAGE_SIZES } from '@/lib/constants'
import { cn, formatDate, truncate } from '@/lib/utils'
import type { Feedback, SortField } from '@/types'
import { PriorityBadge, StatusBadge } from './StatusBadge'
import { EmptyState, ErrorState, LoadingState } from './States'

export type TableVariant = 'admin' | 'user'

interface Props {
  variant: TableVariant
  rows: Feedback[]
  total: number
  loading: boolean
  error: string | null
  onRetry: () => void
  page: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize: (n: number) => void
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  onSort: (f: SortField) => void
  onOpen: (row: Feedback) => void
  onViewScreenshot: (row: Feedback) => void
  hasFilters: boolean
  emptyTitle: string
  emptyDescription?: string
}

const STORAGE_KEY = 'feedback-columns-v2'
// Default view: Sr.No, Validated by, Stream, Feature, Page Name, Component type, Owner, Sub Owner, Comments, Status, ETA, Challenges.
const EXTRA_HIDDEN: VisibilityState = { feedback_number: false, feedback_type: false, screenshot: false, priority: false, date_reported: false, date_completed: false }
const ADMIN_DEFAULT_HIDDEN: VisibilityState = EXTRA_HIDDEN
const USER_HIDDEN: VisibilityState = { ...EXTRA_HIDDEN, owner: false, sub_owner: false, challenges: false, reported_by_name: false, sr: false, feedback_number: true, priority: true }

function loadVisibility(variant: TableVariant): VisibilityState {
  if (variant === 'user') return USER_HIDDEN
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as VisibilityState
  } catch { /* ignore */ }
  return ADMIN_DEFAULT_HIDDEN
}

const COLUMN_LABELS: Record<string, string> = {
  sr: 'Sr. No.', feedback_number: 'Feedback ID', business: 'Stream', dashboard_path: 'Feature', card_graph_name: 'Page Name', component_category: 'Component type', feedback_type: 'Feedback Type',
  changes_required: 'Comments', screenshot: 'Screenshot', priority: 'Priority', owner: 'Owner', sub_owner: 'Sub Owner Name', eta: 'ETA', challenges: 'Challenges if any', status: 'Status',
  reported_by_name: 'Validated by', date_reported: 'Date Reported', date_completed: 'Date Completed',
}

export function FeedbackTable(p: Props) {
  const [visibility, setVisibility] = useState<VisibilityState>(() => loadVisibility(p.variant))
  const [showCols, setShowCols] = useState(false)
  const offset = p.page * p.pageSize

  const columns = useMemo<ColumnDef<Feedback>[]>(() => {
    const sortable = (id: SortField): Pick<ColumnDef<Feedback>, 'meta'> => ({ meta: { sort: id } })
    const defs: ColumnDef<Feedback>[] = [
      { id: 'sr', header: 'Sr. No.', size: 64, minSize: 50, enableSorting: false, cell: (c) => <span className="tabular-nums text-subtle">{offset + c.row.index + 1}</span> },
      { id: 'feedback_number', header: 'Feedback ID', size: 110, ...sortable('feedback_number'), cell: (c) => <span className="font-mono text-xs font-semibold text-brand">{c.row.original.feedback_number}</span> },
      {
        id: 'reported_by_name', header: 'Validated by', size: 160, ...sortable('reported_by_name'),
        cell: (c) => (
          <div className="min-w-0"><p className="truncate">{c.row.original.reported_by_name}</p><p className="truncate text-xs text-subtle">{c.row.original.reported_by_email}</p></div>
        ),
      },
      { id: 'business', header: 'Stream', size: 95, ...sortable('business'), cell: (c) => c.row.original.business ?? '—' },
      { id: 'dashboard_path', header: 'Feature', size: 210, ...sortable('dashboard_path'), cell: (c) => <p className="truncate" title={c.row.original.dashboard_path ?? ''}>{c.row.original.dashboard_path ?? '—'}</p> },
      { id: 'card_graph_name', header: 'Page Name', size: 180, ...sortable('card_graph_name'), cell: (c) => <p className="truncate font-medium" title={c.row.original.card_graph_name}>{c.row.original.card_graph_name}</p> },
      { id: 'component_category', header: 'Component type', size: 140, ...sortable('component_category'), cell: (c) => c.row.original.component_category },
      { id: 'feedback_type', header: 'Feedback Type', size: 140, ...sortable('feedback_type'), cell: (c) => c.row.original.feedback_type },
      { id: 'owner', header: 'Owner', size: 130, ...sortable('owner'), cell: (c) => c.row.original.owner ?? <span className="text-subtle">Unassigned</span> },
      { id: 'sub_owner', header: 'Sub Owner Name', size: 140, ...sortable('sub_owner'), cell: (c) => c.row.original.sub_owner ?? <span className="text-subtle">—</span> },
      {
        id: 'changes_required', header: 'Comments', size: 320, enableSorting: false,
        cell: (c) => <p className="line-clamp-2 whitespace-normal" title={c.row.original.changes_required}>{truncate(c.row.original.changes_required, 220)}</p>,
      },
      { id: 'status', header: 'Status', size: 130, ...sortable('status'), cell: (c) => <StatusBadge status={c.row.original.status} /> },
      { id: 'eta', header: 'ETA', size: 110, ...sortable('eta'), cell: (c) => <span className="tabular-nums">{c.row.original.eta ? formatDate(`${c.row.original.eta}T00:00:00`) : '—'}</span> },
      {
        id: 'challenges', header: 'Challenges if any', size: 240, enableSorting: false,
        cell: (c) => c.row.original.challenges
          ? <p className="line-clamp-2 whitespace-normal" title={c.row.original.challenges}>{truncate(c.row.original.challenges, 160)}</p>
          : <span className="text-subtle">—</span>,
      },
      {
        id: 'screenshot', header: 'Screenshot', size: 100, enableSorting: false,
        cell: (c) => c.row.original.screenshot_path ? (
          <button className="btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); p.onViewScreenshot(c.row.original) }}
            aria-label={`View screenshot for ${c.row.original.feedback_number}`}>
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> View
          </button>
        ) : <span className="text-subtle">None</span>,
      },
      { id: 'priority', header: 'Priority', size: 105, ...sortable('priority'), cell: (c) => <PriorityBadge priority={c.row.original.priority} /> },
      { id: 'date_reported', header: 'Date Reported', size: 120, ...sortable('date_reported'), cell: (c) => <span className="tabular-nums">{formatDate(c.row.original.date_reported)}</span> },
      {
        id: 'date_completed', header: 'Date Completed', size: 125, ...sortable('date_completed'),
        cell: (c) => <span className="tabular-nums">{c.row.original.status === 'Completed' ? formatDate(c.row.original.date_completed) : '—'}</span>,
      },
    ]
    if (p.variant === 'admin') {
      defs.push({
        id: 'actions', header: 'Actions', size: 95, enableSorting: false, enableHiding: false,
        cell: (c) => <button className="btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); p.onOpen(c.row.original) }}>Details</button>,
      })
    }
    return defs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, p.variant, p.onOpen, p.onViewScreenshot])

  const table = useReactTable({
    data: p.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (u) => {
      setVisibility((prev) => {
        const next = typeof u === 'function' ? u(prev) : u
        if (p.variant === 'admin') { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ } }
        return next
      })
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    manualSorting: true,
    manualPagination: true,
    getRowId: (r) => r.id,
  })

  const pageCount = Math.max(1, Math.ceil(p.total / p.pageSize))
  const from = p.total === 0 ? 0 : offset + 1
  const to = Math.min(offset + p.pageSize, p.total)

  const body = (() => {
    if (p.error) return <ErrorState message={p.error} onRetry={p.onRetry} />
    if (p.loading && p.rows.length === 0) return <LoadingState variant="table" />
    if (p.rows.length === 0) {
      return <EmptyState title={p.hasFilters ? 'No feedback matches the selected filters.' : p.emptyTitle} description={p.hasFilters ? 'Try adjusting or resetting the filters.' : p.emptyDescription} />
    }
    return (
      <>
        {/* Table: md and up */}
        <div className={cn('hidden overflow-x-auto md:block', p.loading && 'opacity-60 transition-opacity')} aria-busy={p.loading}>
          <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: table.getTotalSize() }}>
            <thead className="sticky top-0 bg-muted">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sortField = (h.column.columnDef.meta as { sort?: SortField } | undefined)?.sort
                    const active = sortField && sortField === p.sortBy
                    return (
                      <th key={h.id} style={{ width: h.getSize() }} scope="col"
                        aria-sort={active ? (p.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="relative border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                        {sortField ? (
                          <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => p.onSort(sortField)}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {active ? (p.sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanResize() && (
                          <div role="separator" aria-orientation="vertical" aria-label={`Resize ${COLUMN_LABELS[h.column.id] ?? h.column.id} column`}
                            onMouseDown={h.getResizeHandler()} onTouchStart={h.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                            className={cn('absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-brand/50', h.column.getIsResizing() && 'bg-brand')} />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} tabIndex={0} onClick={() => p.onOpen(row.original)}
                  onKeyDown={(e) => { if (e.key === 'Enter') p.onOpen(row.original) }}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-brand-soft/60 focus-visible:bg-brand-soft">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }} className="overflow-hidden px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards: below md */}
        <ul className={cn('divide-y divide-border md:hidden', p.loading && 'opacity-60')}>
          {p.rows.map((r) => (
            <li key={r.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-brand">{r.feedback_number}</p>
                  <p className="truncate font-semibold">{r.card_graph_name}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="line-clamp-2 text-subtle">{r.changes_required}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div><dt className="text-subtle">Priority</dt><dd><PriorityBadge priority={r.priority} /></dd></div>
                {p.variant === 'admin' && <div><dt className="text-subtle">Owner</dt><dd className="font-medium">{r.owner ?? 'Unassigned'}</dd></div>}
                <div><dt className="text-subtle">Date</dt><dd className="font-medium">{formatDate(r.date_reported)}</dd></div>
                {r.status === 'Completed' && <div><dt className="text-subtle">Completed</dt><dd className="font-medium">{formatDate(r.date_completed)}</dd></div>}
              </dl>
              <div className="flex gap-2 pt-1">
                <button className="btn-primary btn-sm" onClick={() => p.onOpen(r)}>View Details</button>
                {r.screenshot_path && <button className="btn-secondary btn-sm" onClick={() => p.onViewScreenshot(r)}>Screenshot</button>}
              </div>
            </li>
          ))}
        </ul>
      </>
    )
  })()

  return (
    <div className="card overflow-hidden">
      {p.variant === 'admin' && (
        <div className="relative flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs text-subtle" aria-live="polite">{p.loading ? 'Loading…' : `${p.total.toLocaleString()} result${p.total === 1 ? '' : 's'}`}</p>
          <div className="relative hidden md:block">
            <button className="btn-secondary btn-sm" onClick={() => setShowCols((s) => !s)} aria-expanded={showCols} aria-haspopup="true">
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" /> Columns
            </button>
            {showCols && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg" onKeyDown={(e) => e.key === 'Escape' && setShowCols(false)}>
                {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                    <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                    {COLUMN_LABELS[c.id] ?? c.id}
                  </label>
                ))}
                <button className="btn-ghost btn-sm mt-1 w-full" onClick={() => setShowCols(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {body}

      {!p.error && p.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-subtle">
          <div className="flex items-center gap-2">
            <label htmlFor="page-size">Rows per page</label>
            <select id="page-size" className="field-input h-8 w-auto py-1" value={p.pageSize} onChange={(e) => p.onPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <p aria-live="polite">{from}–{to} of {p.total.toLocaleString()}</p>
          <div className="flex items-center gap-1">
            <button className="btn-secondary btn-sm" onClick={() => p.onPage(p.page - 1)} disabled={p.page === 0} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 tabular-nums">Page {p.page + 1} / {pageCount}</span>
            <button className="btn-secondary btn-sm" onClick={() => p.onPage(p.page + 1)} disabled={p.page + 1 >= pageCount} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
