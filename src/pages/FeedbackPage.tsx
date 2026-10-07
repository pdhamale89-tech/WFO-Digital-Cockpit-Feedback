import { FeedbackForm } from '@/components/FeedbackForm'
import { ErrorState, LoadingState } from '@/components/States'
import { useAsync } from '@/hooks/useAsync'
import { getScreenshotRequired, listAssignees, listDashboardOptions, listOwners } from '@/services/feedbackService'

export function FeedbackPage() {
  const cfg = useAsync(async () => ({ required: await getScreenshotRequired(), options: await listDashboardOptions(), owners: (await listOwners()).map((o) => o.name), assignees: (await listAssignees()).map((a) => a.name) }), [])
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 rounded-xl border border-border bg-brand-soft p-5">
        <p className="text-sm font-semibold text-brand">Help us improve the WFO Digital Cockpit</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Report Digital Cockpit Feedback</h1>
        <p className="mt-2 text-subtle">
          During validation, report any data, UI, calculation, or functionality issue with a screenshot so the development team can resolve it quickly.
        </p>
      </div>
      {cfg.loading ? <LoadingState variant="table" rows={5} />
        : cfg.error ? <ErrorState message={cfg.error} onRetry={cfg.reload} />
        : <FeedbackForm screenshotRequired={cfg.data?.required ?? true} dashboardOptions={cfg.data?.options ?? []} owners={cfg.data?.owners ?? []} assignees={cfg.data?.assignees ?? []} />}
    </div>
  )
}
