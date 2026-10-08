import { supabase } from '@/lib/supabase'
import { dayEndIso, dayStartIso } from '@/lib/utils'
import type {
  Business, DashboardOption, Feedback, FeedbackHistoryEntry, FeedbackQuery, FeedbackStats, Owner, Assignee, Priority, SortField, Status,
} from '@/types'
import type { FeedbackFormValues } from '@/lib/schemas'
import { removeScreenshot, uploadScreenshot } from './storageService'

const SORTABLE: readonly SortField[] = [
  'feedback_number', 'business', 'dashboard_path', 'card_graph_name', 'feedback_type', 'priority', 'owner',
  'component_category', 'sub_owner', 'eta', 'status', 'reported_by_name', 'date_reported', 'date_completed',
]

/** Strip characters that have meaning inside a PostgREST or()/ilike filter. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim()
}

type Builder<T> = T & {
  eq: (c: string, v: string) => Builder<T>
  or: (f: string) => Builder<T>
  gte: (c: string, v: string) => Builder<T>
  lte: (c: string, v: string) => Builder<T>
  is: (c: string, v: null) => Builder<T>
}

function applyFilters<T>(builder: T, q: Omit<FeedbackQuery, 'page' | 'pageSize' | 'sortBy' | 'sortDir'>): T {
  let b = builder as Builder<T>
  if (q.mineOnly && q.userId) b = b.eq('reported_by', q.userId)
  if (q.status) b = b.eq('status', q.status)
  if (q.priority) b = b.eq('priority', q.priority)
  if (q.type) b = b.eq('feedback_type', q.type)
  if (q.business) b = b.eq('business', q.business)
  if (q.owner === '__unassigned__') b = b.is('owner', null)
  else if (q.owner) b = b.eq('owner', q.owner)
  if (q.dateFrom) b = b.gte('date_reported', dayStartIso(q.dateFrom))
  if (q.dateTo) b = b.lte('date_reported', dayEndIso(q.dateTo))
  const s = sanitizeSearch(q.search)
  if (s) {
    const p = `%${s}%`
    b = b.or(
      ['feedback_number', 'card_graph_name', 'changes_required', 'owner', 'sub_owner', 'reported_by_name', 'reported_by_email']
        .map((c) => `${c}.ilike.${p}`).join(','),
    )
  }
  return b as T
}

export async function listFeedback(q: FeedbackQuery): Promise<{ rows: Feedback[]; total: number }> {
  const sortBy = SORTABLE.includes(q.sortBy) ? q.sortBy : 'date_reported'
  const from = q.page * q.pageSize
  const base = supabase.from('feedback').select('*', { count: 'exact' })
  const { data, error, count } = await applyFilters(base, q)
    .order(sortBy, { ascending: q.sortDir === 'asc', nullsFirst: false })
    .order('feedback_number', { ascending: false })
    .range(from, from + q.pageSize - 1)
  if (error) throw error
  return { rows: (data ?? []) as Feedback[], total: count ?? 0 }
}

/** Fetch every row matching the filters (for export), in chunks. */
export async function listAllForExport(q: Omit<FeedbackQuery, 'page' | 'pageSize'>): Promise<Feedback[]> {
  const chunk = 1000
  const out: Feedback[] = []
  for (let page = 0; page < 100; page++) {
    const base = supabase.from('feedback').select('*')
    const { data, error } = await applyFilters(base, q)
      .order(q.sortBy, { ascending: q.sortDir === 'asc', nullsFirst: false })
      .order('feedback_number', { ascending: false })
      .range(page * chunk, page * chunk + chunk - 1)
    if (error) throw error
    out.push(...((data ?? []) as Feedback[]))
    if (!data || data.length < chunk) break
  }
  return out
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  const { data, error } = await supabase.from('feedback').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Feedback | null
}

export async function createFeedback(
  values: FeedbackFormValues,
  userId: string,
  onProgress?: (pct: number) => void,
  dashboardPath: string | null = null,
): Promise<{ id: string; feedback_number: string }> {
  let screenshotPath: string | null = null
  if (values.screenshot) screenshotPath = await uploadScreenshot(userId, values.screenshot as File, onProgress)

  // reported_by / name / email / status / dates are set by database triggers, not by the client.
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      business: values.business,
      dashboard_path: dashboardPath,
      component_category: values.component_category,
      card_graph_name: values.card_graph_name.trim(),
      feedback_type: values.feedback_type,
      changes_required: values.changes_required.trim(),
      priority: values.priority,
      owner: values.owner || null,
      sub_owner: values.assignee || null,
      screenshot_path: screenshotPath,
      reported_by: userId, // must equal auth.uid(); enforced by RLS + trigger
    })
    .select('id, feedback_number')
    .single()

  if (error) {
    if (screenshotPath) await removeScreenshot(screenshotPath).catch(() => undefined)
    throw error
  }
  return data
}

export interface AdminUpdate {
  status?: Status
  owner?: string | null
  sub_owner?: string | null
  eta?: string | null
  challenges?: string | null
  priority?: Priority
  resolution?: string | null
  admin_comments?: string | null
  card_graph_name?: string
  feedback_type?: Feedback['feedback_type']
  changes_required?: string
}

export async function updateFeedback(id: string, patch: AdminUpdate): Promise<Feedback> {
  const { data, error } = await supabase.from('feedback').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Feedback
}

export async function addUserComment(id: string, comment: string): Promise<Feedback> {
  const { data, error } = await supabase.from('feedback').update({ user_comments: comment }).eq('id', id).select('*').single()
  if (error) throw error
  return data as Feedback
}

/** Reporters may move their own feedback along the allowed workflow (enforced by the database). */
export async function updateOwnStatus(id: string, status: Status): Promise<Feedback> {
  const { data, error } = await supabase.from('feedback').update({ status }).eq('id', id).select('*').single()
  if (error) throw error
  return data as Feedback
}

export async function deleteFeedback(row: Pick<Feedback, 'id' | 'screenshot_path'>): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', row.id)
  if (error) throw error
  if (row.screenshot_path) await removeScreenshot(row.screenshot_path).catch(() => undefined)
}

export async function getHistory(feedbackId: string): Promise<FeedbackHistoryEntry[]> {
  const { data, error } = await supabase
    .from('feedback_history')
    .select('*, changer:profiles!changed_by(name,email)')
    .eq('feedback_id', feedbackId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as FeedbackHistoryEntry[]
}

export async function getStats(): Promise<FeedbackStats> {
  const { data, error } = await supabase.rpc('admin_feedback_stats')
  if (error) throw error
  return data as FeedbackStats
}

export async function listDashboardOptions(): Promise<DashboardOption[]> {
  const { data, error } = await supabase.from('dashboard_options').select('*').order('sort_order').order('name')
  if (error) throw error
  return (data ?? []) as DashboardOption[]
}

export async function addDashboardOption(business: Business, parentId: string | null, name: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('dashboard_options').insert({ business, parent_id: parentId, name: name.trim(), sort_order: sortOrder })
  if (error) throw error
}

export async function setDashboardOptionActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('dashboard_options').update({ active }).eq('id', id)
  if (error) throw error
}

export async function renameDashboardOption(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('dashboard_options').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

export async function deleteDashboardOption(id: string): Promise<void> {
  const { error } = await supabase.from('dashboard_options').delete().eq('id', id)
  if (error) throw error
}

// --- Admin configuration -----------------------------------------------------

export async function listOwners(includeInactive = false): Promise<Owner[]> {
  let q = supabase.from('owners').select('*').order('sort_order').order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Owner[]
}

export async function addOwner(name: string): Promise<void> {
  const { error } = await supabase.from('owners').insert({ name: name.trim(), sort_order: 100 })
  if (error) throw error
}

export async function setOwnerActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('owners').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteOwner(id: string): Promise<void> {
  const { error } = await supabase.from('owners').delete().eq('id', id)
  if (error) throw error
}

export async function listAssignees(includeInactive = false): Promise<Assignee[]> {
  let q = supabase.from('assignees').select('*').order('sort_order').order('name')
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Assignee[]
}

export async function addAssignee(name: string): Promise<void> {
  const { error } = await supabase.from('assignees').insert({ name: name.trim() })
  if (error) throw error
}

export async function setAssigneeActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('assignees').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteAssignee(id: string): Promise<void> {
  const { error } = await supabase.from('assignees').delete().eq('id', id)
  if (error) throw error
}

export async function getScreenshotRequired(): Promise<boolean> {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', 'screenshot_required').maybeSingle()
  if (error) throw error
  return data ? Boolean(data.value) : true
}

export async function setScreenshotRequired(required: boolean): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'screenshot_required', value: required, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function listAdminEmails(): Promise<string[]> {
  const { data, error } = await supabase.from('admin_emails').select('email').order('email')
  if (error) throw error
  return (data ?? []).map((r) => r.email as string)
}

export async function addAdminEmail(email: string): Promise<void> {
  const { error } = await supabase.from('admin_emails').insert({ email: email.trim().toLowerCase() })
  if (error) throw error
}

export async function removeAdminEmail(email: string): Promise<void> {
  const { error } = await supabase.from('admin_emails').delete().eq('email', email)
  if (error) throw error
}

export async function updateProfileName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', userId)
  if (error) throw error
}
