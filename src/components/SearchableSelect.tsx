import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface Props {
  id: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  emptyLabel?: string
  className?: string
}

/** Accessible combobox: type to filter, arrows/Enter to pick, Escape to close. Empty value = nothing selected. */
export function SearchableSelect({ id, value, onChange, options, placeholder = 'Search…', emptyLabel = 'No matches', className = '' }: Props) {
  const listId = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[active]) pick(filtered[active]) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQuery('') }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <input
        id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        className="field-input pr-14" autoComplete="off" placeholder={value ? '' : placeholder}
        value={open ? query : value}
        onFocus={() => { setOpen(true); setActive(0) }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={onKey}
      />
      <span className="absolute inset-y-0 right-2 flex items-center gap-1">
        {value && (
          <button type="button" className="rounded p-0.5 text-subtle hover:text-fg" aria-label="Clear selection" onClick={() => pick('')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <ChevronDown className="h-4 w-4 text-subtle" aria-hidden="true" />
      </span>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {filtered.length === 0 && <li className="px-3 py-2 text-subtle">{emptyLabel}</li>}
          {filtered.map((o, i) => (
            <li
              key={o} id={`${listId}-${i}`} role="option" aria-selected={o === value}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-brand-soft' : ''} ${o === value ? 'font-semibold' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setActive(i)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
