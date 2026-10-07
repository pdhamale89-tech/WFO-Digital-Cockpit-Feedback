import type { BUSINESSES, COMPONENT_CATEGORIES, FEEDBACK_TYPES, PRIORITIES, STATUSES } from '@/lib/constants'

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number]
export type Business = (typeof BUSINESSES)[number]
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Status = (typeof STATUSES)[number]
export type Role = 'user' | 'admin'

export interface Profile {
  id: string
  email: string
  name: string
  role: Role
  created_at: string
}

export interface Feedback {
  id: string
  feedback_number: string
  business: Business | null
  dashboard_path: string | null
  component_category: ComponentCategory
  card_graph_name: string
  feedback_type: FeedbackType
  changes_required: string
  screenshot_path: string | null
  reported_by: string
  reported_by_name: string
  reported_by_email: string
  priority: Priority
  owner: string | null
  status: Status
  date_reported: string
  date_completed: string | null
  resolution: string | null
  admin_comments: string | null
  user_comments: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackHistoryEntry {
  history_id: string
  feedback_id: string
  changed_by: string | null
  changed_at: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changer?: { name: string; email: string } | null
}

export interface Owner {
  id: string
  name: string
  email: string | null
  active: boolean
  sort_order: number
}

export interface CountItem { name: string; count: number }
export interface TrendItem { week: string; count: number }

export interface FeedbackStats {
  total: number
  new_count: number
  in_progress: number
  completed: number
  critical_high: number
  by_status: CountItem[]
  by_priority: CountItem[]
  by_type: CountItem[]
  by_owner: CountItem[]
  reported_trend: TrendItem[]
  completed_trend: TrendItem[]
}

export type SortField =
  | 'feedback_number' | 'business' | 'dashboard_path' | 'card_graph_name' | 'feedback_type' | 'priority' | 'owner'
  | 'status' | 'reported_by_name' | 'date_reported' | 'date_completed'

export interface FeedbackFilters {
  search: string
  status: string
  priority: string
  owner: string
  type: string
  business: string
  dateFrom: string
  dateTo: string
}

export interface FeedbackQuery extends FeedbackFilters {
  page: number // 0-based
  pageSize: number
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  /** Restrict to the signed-in user's own rows (RLS enforces this regardless). */
  mineOnly?: boolean
  userId?: string
}

export const EMPTY_FILTERS: FeedbackFilters = {
  search: '', status: '', priority: '', owner: '', type: '', business: '', dateFrom: '', dateTo: '',
}

export interface DashboardOption {
  id: string
  business: Business
  parent_id: string | null
  name: string
  active: boolean
  sort_order: number
}
