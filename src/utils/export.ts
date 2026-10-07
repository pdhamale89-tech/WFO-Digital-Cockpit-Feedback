import type { Feedback } from '@/types'
import { formatDateTime } from '@/lib/utils'

const HEADERS = [
  'Feedback ID', 'Business', 'Dashboard', 'Component Type', 'Cards / Graph Name', 'Feedback Type', 'Changes Required', 'Priority',
  'Owner', 'Sub Owner', 'Status', 'ETA', 'Challenges', 'Reported By', 'Reporter Email', 'Date Reported', 'Date Completed', 'Resolution', 'Admin Comments',
]

function rowValues(f: Feedback): string[] {
  return [
    f.feedback_number, f.business ?? '', f.dashboard_path ?? '', f.component_category, f.card_graph_name, f.feedback_type, f.changes_required, f.priority,
    f.owner ?? '', f.sub_owner ?? '', f.status, f.eta ?? '', f.challenges ?? '', f.reported_by_name, f.reported_by_email, formatDateTime(f.date_reported),
    f.status === 'Completed' ? formatDateTime(f.date_completed) : '', f.resolution ?? '', f.admin_comments ?? '',
  ]
}

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at start of a cell). */
export function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

export function toCsv(rows: Feedback[]): string {
  const esc = (v: string) => `"${safeCell(v).replace(/"/g, '""')}"`
  return [HEADERS, ...rows.map(rowValues)].map((r) => r.map(esc).join(',')).join('\r\n')
}

const escHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Excel-compatible HTML table (opens natively in Excel as .xls). */
export function toExcelHtml(rows: Feedback[]): string {
  const head = `<tr>${HEADERS.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr>`
  const body = rows.map((r) => `<tr>${rowValues(r).map((c) => `<td>${escHtml(safeCell(c))}</td>`).join('')}</tr>`).join('')
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${head}${body}</table></body></html>`
}

export function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob(['﻿', content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
