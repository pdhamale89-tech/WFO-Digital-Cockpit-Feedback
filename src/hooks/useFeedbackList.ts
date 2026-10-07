import { useCallback, useMemo, useState } from 'react'
import { listFeedback } from '@/services/feedbackService'
import { EMPTY_FILTERS, type FeedbackFilters, type FeedbackQuery, type SortField } from '@/types'
import { useAsync } from './useAsync'

/** Shared state + server-side data loading for filterable, sortable, paginated feedback lists. */
export function useFeedbackList(opts: { mineOnly?: boolean; userId?: string; pageSize?: number } = {}) {
  const [filters, setFilters] = useState<FeedbackFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(opts.pageSize ?? 25)
  const [sortBy, setSortBy] = useState<SortField>('date_reported')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const query = useMemo<FeedbackQuery>(
    () => ({ ...filters, page, pageSize, sortBy, sortDir, mineOnly: opts.mineOnly, userId: opts.userId }),
    [filters, page, pageSize, sortBy, sortDir, opts.mineOnly, opts.userId],
  )

  const result = useAsync(() => listFeedback(query), [JSON.stringify(query)])

  const patchFilters = useCallback((patch: Partial<FeedbackFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }, [])

  const onSort = useCallback((field: SortField) => {
    setPage(0)
    setSortBy((cur) => {
      if (cur === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return cur }
      setSortDir('asc')
      return field
    })
  }, [])

  const changePageSize = useCallback((n: number) => { setPageSize(n); setPage(0) }, [])

  const hasFilters = (Object.keys(EMPTY_FILTERS) as (keyof FeedbackFilters)[]).some((k) => filters[k] !== EMPTY_FILTERS[k])

  return {
    query, filters, patchFilters, page, setPage, pageSize, changePageSize, sortBy, sortDir, onSort, hasFilters,
    rows: result.data?.rows ?? [], total: result.data?.total ?? 0,
    loading: result.loading, error: result.error, reload: result.reload,
  }
}
