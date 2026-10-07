import { useEffect, useState } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { FEEDBACK_TYPES, PRIORITIES, STATUSES } from '@/lib/constants'
import { useDebounce } from '@/hooks/useDebounce'
import { EMPTY_FILTERS, type FeedbackFilters } from '@/types'

interface Props {
  filters: FeedbackFilters
  onChange: (patch: Partial<FeedbackFilters>) => void
  owners?: string[]          // omit to hide the owner filter (user view)
  showOwner?: boolean
}

const sel = 'field-input h-9 py-1.5'

export function FilterBar({ filters, onChange, owners = [], showOwner = true }: Props) {
  const [search, setSearch] = useState(filters.search)
  const debounced = useDebounce(search, 350)

  useEffect(() => { if (debounced !== filters.search) onChange({ search: debounced }) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounced])
  // External reset
  useEffect(() => { if (filters.search === '' && search !== '' && debounced === search) setSearch('') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.search])

  const active = (Object.keys(EMPTY_FILTERS) as (keyof FeedbackFilters)[]).some((k) => filters[k] !== EMPTY_FILTERS[k]) || search !== ''

  return (
    <div className="flex flex-wrap items-end gap-2" role="search" aria-label="Filter feedback">
      <div className="relative min-w-[200px] flex-1 basis-56">
        <label htmlFor="flt-search" className="sr-only">Search feedback</label>
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-subtle" aria-hidden="true" />
        <input id="flt-search" type="search" className={`${sel} pl-8 pr-8`} placeholder="Search ID, component, issue, owner, reporter…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && (
          <button className="absolute right-1.5 top-1.5 rounded p-1 text-subtle hover:bg-muted" onClick={() => { setSearch(''); onChange({ search: '' }) }} aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Select label="Status" value={filters.status} onChange={(v) => onChange({ status: v })} options={STATUSES} />
      <Select label="Priority" value={filters.priority} onChange={(v) => onChange({ priority: v })} options={PRIORITIES} />
      {showOwner && (
        <Select label="Owner" value={filters.owner} onChange={(v) => onChange({ owner: v })}
          options={owners} extra={[{ value: '__unassigned__', label: 'Unassigned' }]} />
      )}
      <Select label="Type" value={filters.type} onChange={(v) => onChange({ type: v })} options={FEEDBACK_TYPES} />
      <div>
        <label htmlFor="flt-from" className="sr-only">Reported from</label>
        <input id="flt-from" type="date" className={`${sel} w-[8.5rem]`} value={filters.dateFrom} max={filters.dateTo || undefined}
          onChange={(e) => onChange({ dateFrom: e.target.value })} title="Reported from" />
      </div>
      <div>
        <label htmlFor="flt-to" className="sr-only">Reported to</label>
        <input id="flt-to" type="date" className={`${sel} w-[8.5rem]`} value={filters.dateTo} min={filters.dateFrom || undefined}
          onChange={(e) => onChange({ dateTo: e.target.value })} title="Reported to" />
      </div>
      <button className="btn-secondary h-9" onClick={() => { setSearch(''); onChange({ ...EMPTY_FILTERS }) }} disabled={!active}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset
      </button>
    </div>
  )
}

function Select({ label, value, onChange, options, extra = [] }: {
  label: string; value: string; onChange: (v: string) => void
  options: readonly string[]; extra?: { value: string; label: string }[]
}) {
  const id = `flt-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} className={`${sel} w-auto min-w-[7.5rem]`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All {label.toLowerCase()}</option>
        {extra.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
