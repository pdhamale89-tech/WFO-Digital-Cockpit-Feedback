import type { ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { useAsync } from '@/hooks/useAsync'
import { formatDate } from '@/lib/utils'
import { getStats } from '@/services/feedbackService'
import type { CountItem, TrendItem } from '@/types'

const STATUS_COLOR: Record<string, string> = {
  New: '#2563eb', 'Under Review': '#9333ea', 'In Progress': '#d97706', Blocked: '#dc2626', Completed: '#16a34a', Rejected: '#6b7280',
}
const PRIORITY_COLOR: Record<string, string> = { Critical: '#dc2626', High: '#ea580c', Medium: '#0284c7', Low: '#6b7280' }
const BRAND = 'rgb(var(--brand))'
const axis = { fontSize: 12, fill: 'rgb(var(--subtle))' }
const tooltipStyle = { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 8, color: 'rgb(var(--fg))' }

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {empty ? <EmptyState title="No data yet" /> : <div className="h-64">{children}</div>}
    </section>
  )
}

function Bars({ data, colors }: { data: CountItem[]; colors?: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={axis} interval={0} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--muted))' }} />
        <Bar dataKey="count" name="Feedback" radius={[4, 4, 0, 0]} fill={BRAND}>
          {colors && data.map((d) => <Cell key={d.name} fill={colors[d.name] ?? BRAND} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Trend({ data, label }: { data: TrendItem[]; label: string }) {
  const rows = data.map((d) => ({ ...d, label: formatDate(d.week) }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ left: -10, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Week of ${l}`} />
        <Line type="monotone" dataKey="count" name={label} stroke={BRAND} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function AnalyticsPage() {
  const { data: s, loading, error, reload } = useAsync(getStats, [])
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Feedback volume, ownership and resolution trends." />
      {loading && !s ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <LoadingState key={i} variant="chart" />)}</div>
      ) : error ? <div className="card"><ErrorState message={error} onRetry={reload} /></div> : s && (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <ChartCard title="Feedback by Status" empty={s.by_status.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={s.by_status} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                  {s.by_status.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name] ?? BRAND} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Feedback by Priority" empty={s.by_priority.length === 0}>
            <Bars data={['Critical', 'High', 'Medium', 'Low'].map((n) => ({ name: n, count: s.by_priority.find((x) => x.name === n)?.count ?? 0 }))} colors={PRIORITY_COLOR} />
          </ChartCard>
          <ChartCard title="Feedback by Type" empty={s.by_type.length === 0}><Bars data={s.by_type} /></ChartCard>
          <ChartCard title="Feedback by Owner" empty={s.by_owner.length === 0}><Bars data={s.by_owner} /></ChartCard>
          <ChartCard title="Feedback Trend (reported per week)" empty={s.reported_trend.length === 0}><Trend data={s.reported_trend} label="Reported" /></ChartCard>
          <ChartCard title="Completion Trend (completed per week)" empty={s.completed_trend.length === 0}><Trend data={s.completed_trend} label="Completed" /></ChartCard>
        </div>
      )}
    </div>
  )
}
