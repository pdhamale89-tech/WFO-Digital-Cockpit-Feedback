import { describe, expect, it } from 'vitest'
import { buildFeedbackSchema, validateScreenshot } from './schemas'
import { safeCell, toCsv } from '@/utils/export'
import { sanitizeSearch } from '@/services/feedbackService'
import { formatDate, formatBytes } from './utils'
import { toUserMessage } from './errors'
import type { Feedback } from '@/types'

const file = (type: string, size: number) => ({ type, size, name: 'a' }) as File

describe('validateScreenshot', () => {
  it('accepts png/jpg/webp under 10MB', () => {
    for (const t of ['image/png', 'image/jpeg', 'image/webp']) expect(validateScreenshot(file(t, 1000))).toBeNull()
  })
  it('rejects wrong type, oversize and empty', () => {
    expect(validateScreenshot(file('application/pdf', 1000))).toMatch(/Unsupported/)
    expect(validateScreenshot(file('image/png', 10 * 1024 * 1024 + 1))).toMatch(/too large/)
    expect(validateScreenshot(file('image/png', 0))).toMatch(/empty/)
  })
})

describe('feedback schema', () => {
  const valid = {
    component_category: 'KPI Card', card_graph_name: 'Contact Volume Trend', feedback_type: 'Data Issue',
    changes_required: 'Contact count differs from source', priority: 'Medium', screenshot: file('image/png', 5),
  }
  it('requires a screenshot when configured', () => {
    expect(buildFeedbackSchema(true).safeParse({ ...valid, screenshot: null }).success).toBe(false)
    expect(buildFeedbackSchema(false).safeParse({ ...valid, screenshot: null }).success).toBe(true)
  })
  it('accepts a valid submission and rejects short descriptions', () => {
    expect(buildFeedbackSchema(true).safeParse(valid).success).toBe(true)
    expect(buildFeedbackSchema(true).safeParse({ ...valid, changes_required: 'short' }).success).toBe(false)
  })
})

describe('helpers', () => {
  it('neutralises spreadsheet formulas in exports', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(safeCell('normal')).toBe('normal')
    const row = { feedback_number: 'WF-0001', component_category: 'Table', card_graph_name: 'x', feedback_type: 'Other', changes_required: '=1+1', priority: 'Low', owner: null, status: 'New', reported_by_name: 'a', reported_by_email: 'a@b.c', date_reported: '2026-10-07T00:00:00Z', date_completed: null, resolution: null, admin_comments: null } as Feedback
    expect(toCsv([row])).toContain(`"'=1+1"`)
  })
  it('strips PostgREST filter metacharacters from search', () => {
    expect(sanitizeSearch('a,b)(c%"d')).toBe('a b c d')
  })
  it('formats dates and sizes', () => {
    expect(formatDate('2026-10-07T12:00:00Z')).toMatch(/^\d{2}-Oct-2026$/)
    expect(formatDate(null)).toBe('—')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB')
  })
  it('never leaks raw database errors', () => {
    expect(toUserMessage({ message: 'duplicate key value violates unique constraint "pg_x"' })).not.toMatch(/duplicate key/)
    expect(toUserMessage({ message: 'new row violates row-level security policy' })).toMatch(/permission/)
  })
})
