import { childrenOf, levelLabel } from '@/utils/tree'
import type { DashboardOption } from '@/types'
import { FormField } from './FormField'

interface Props {
  business: string | undefined
  options: DashboardOption[]
  value: string[]
  onChange: (ids: string[]) => void
  error?: string
}

/** Cascading dropdowns: one per level, each shown only when the previous choice has active children. */
export function DashboardPathSelect({ business, options, value, onChange, error }: Props) {
  if (!business) return null
  const levels: { parent: string | null; items: DashboardOption[] }[] = []
  for (let i = 0; i <= value.length; i++) {
    const parent = i === 0 ? null : value[i - 1]
    const items = childrenOf(options, business, parent)
    if (items.length === 0) break
    levels.push({ parent, items })
  }
  if (levels.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {levels.map((lvl, i) => (
        <FormField key={`${business}-${i}`} label={levelLabel(i)} htmlFor={`dash-${i}`} required
          error={i === levels.length - 1 ? error : undefined}>
          <select id={`dash-${i}`} className="field-input" value={value[i] ?? ''} aria-invalid={!!error && i === levels.length - 1}
            onChange={(e) => onChange(e.target.value ? [...value.slice(0, i), e.target.value] : value.slice(0, i))}>
            <option value="">Select {levelLabel(i).toLowerCase()}…</option>
            {lvl.items.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </FormField>
      ))}
    </div>
  )
}
