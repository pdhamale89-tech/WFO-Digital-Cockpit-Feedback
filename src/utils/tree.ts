import type { Business, DashboardOption } from '@/types'

export const LEVEL_LABELS = ['Dashboard', 'Section', 'Sub-section']
export const levelLabel = (level: number) => LEVEL_LABELS[Math.min(level, LEVEL_LABELS.length - 1)]

const byOrder = (a: DashboardOption, b: DashboardOption) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)

export function childrenOf(
  opts: DashboardOption[], business: Business | string | undefined, parentId: string | null, activeOnly = true,
): DashboardOption[] {
  return opts
    .filter((o) => o.parent_id === parentId && (parentId !== null || o.business === business) && (!activeOnly || o.active))
    .sort(byOrder)
}

/** Options for the next dropdown given the ids chosen so far (empty when the path has reached a leaf). */
export function nextLevelOptions(opts: DashboardOption[], business: string | undefined, ids: string[]): DashboardOption[] {
  if (!business) return []
  return childrenOf(opts, business, ids.length ? ids[ids.length - 1] : null)
}

export function pathNames(opts: DashboardOption[], ids: string[]): string[] {
  return ids.map((id) => opts.find((o) => o.id === id)?.name ?? '').filter(Boolean)
}

export const PATH_SEPARATOR = ' > '
