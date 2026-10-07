import { useCallback, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { AlertOctagon, CheckCircle2, CircleDot, Download, FileSpreadsheet, Loader2, MessageSquare, Percent, RefreshCw } from 'lucide-react'
import { FeedbackDrawer } from '@/components/FeedbackDrawer'
import { FeedbackTable } from '@/components/FeedbackTable'
import { FilterBar } from '@/components/FilterBar'
import { KpiCard } from '@/components/KpiCard'
import { PageHeader } from '@/components/PageHeader'
import { ScreenshotViewer } from '@/components/ScreenshotViewer'
import { ErrorState, LoadingState } from '@/components/States'
import { useAsync } from '@/hooks/useAsync'
import { useFeedbackList } from '@/hooks/useFeedbackList'
import { useToast } from '@/hooks/useToast'
import { toUserMessage } from '@/lib/errors'
import { getStats, listAllForExport, listAssignees, listOwners } from '@/services/feedbackService'
import { downloadText, toCsv, toExcelHtml } from '@/utils/export'
import type { Feedback } from '@/types'

/**
 * Mounted once for /admin, /admin/all and /admin/feedback/:id so filters/pagination survive opening and closing
 * the detail drawer. `/admin` = KPI cards + table; `/admin/all` = table only.
 */
export function AdminFeedbackPage() {
  const loc = useLocation()
  const detailMatch = useMatch('/admin/feedback/:id')
  const id = detailMatch?.params.id
  const base = (loc.state as { base?: string } | null)?.base ?? (loc.pathname === '/admin' ? '/admin' : '/admin/all')
  const view: 'overview' | 'all' = base === '/admin' ? 'overview' : 'all'
  const navigate = useNavigate()
  const { toast } = useToast()
  const list = useFeedbackList()
  const owners = useAsync(() => listOwners(), [])
  const assignees = useAsync(() => listAssignees(), [])
  const stats = useAsync(getStats, [])
  const [shot, setShot] = useState<Feedback | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'xls' | null>(null)

  const openRow = useCallback((r: Feedback) => navigate(`/admin/feedback/${r.id}`, { state: { base } }), [navigate, base])
  const closeDrawer = useCallback(() => navigate(base), [navigate, base])
  const refresh = useCallback(() => { list.reload(); stats.reload() }, [list, stats])

  const doExport = async (kind: 'csv' | 'xls') => {
    setExporting(kind)
    try {
      const rows = await listAllForExport({ ...list.query })
      if (rows.length === 0) { toast('info', 'Nothing to export', 'No feedback matches the current filters.'); return }
      const stamp = new Date().toISOString().slice(0, 10)
      if (kind === 'csv') downloadText(toCsv(rows), `feedback-${stamp}.csv`, 'text/csv')
      else downloadText(toExcelHtml(rows), `feedback-${stamp}.xls`, 'application/vnd.ms-excel')
      toast('success', `Exported ${rows.length} record${rows.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast('error', 'Export failed', toUserMessage(e))
    } finally { setExporting(null) }
  }

  const s = stats.data
  const completion = s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0

  return (
    <div>
      <PageHeader
        title={view === 'overview' ? 'WFO Digital Cockpit Feedback' : 'All Feedback'}
        subtitle={view === 'overview' ? 'Validation & Issue Management' : 'Search, triage and manage every reported issue.'}
        actions={<>
          <button className="btn-secondary btn-sm" onClick={refresh} aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          <button className="btn-secondary btn-sm" onClick={() => void doExport('csv')} disabled={exporting !== null}>
            {exporting === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
          </button>
          <button className="btn-secondary btn-sm" onClick={() => void doExport('xls')} disabled={exporting !== null}>
            {exporting === 'xls' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Excel
          </button>
        </>}
      />

      {view === 'overview' && (
        <div className="mb-4">
          {stats.loading && !s ? <LoadingState variant="kpi" />
            : stats.error ? <div className="card"><ErrorState message={stats.error} onRetry={stats.reload} /></div>
            : s && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Total Feedback" value={s.total} icon={MessageSquare} />
                <KpiCard label="New" value={s.new_count} icon={CircleDot} />
                <KpiCard label="In Progress" value={s.in_progress} icon={RefreshCw} tone="warn" />
                <KpiCard label="Completed" value={s.completed} icon={CheckCircle2} tone="success" />
                <KpiCard label="Critical / High" value={s.critical_high} icon={AlertOctagon} tone="danger" />
                <KpiCard label="Completion" value={`${completion}%`} icon={Percent} tone="success" hint={`${s.completed} of ${s.total}`} />
              </div>
            )}
        </div>
      )}

      <div className="mb-3">
        <FilterBar filters={list.filters} onChange={list.patchFilters} owners={(owners.data ?? []).map((o) => o.name)} />
      </div>

      <FeedbackTable
        variant="admin" rows={list.rows} total={list.total} loading={list.loading} error={list.error} onRetry={list.reload}
        page={list.page} pageSize={list.pageSize} onPage={list.setPage} onPageSize={list.changePageSize}
        sortBy={list.sortBy} sortDir={list.sortDir} onSort={list.onSort}
        onOpen={openRow} onViewScreenshot={setShot} hasFilters={list.hasFilters}
        emptyTitle="No feedback submitted yet." emptyDescription="Reported issues will appear here."
      />

      <FeedbackDrawer feedbackId={id ?? null} mode="admin" assignees={(assignees.data ?? []).map((a) => a.name)} owners={(owners.data ?? []).map((o) => o.name)} onClose={closeDrawer} onChanged={refresh} />
      <ScreenshotViewer path={shot?.screenshot_path ?? null} title={shot?.feedback_number ?? ''} onClose={() => setShot(null)} />
    </div>
  )
}
