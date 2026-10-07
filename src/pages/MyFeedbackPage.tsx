import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FeedbackDrawer } from '@/components/FeedbackDrawer'
import { FeedbackTable } from '@/components/FeedbackTable'
import { FilterBar } from '@/components/FilterBar'
import { PageHeader } from '@/components/PageHeader'
import { ScreenshotViewer } from '@/components/ScreenshotViewer'
import { useAuth } from '@/hooks/useAuth'
import { useFeedbackList } from '@/hooks/useFeedbackList'
import type { Feedback } from '@/types'

export function MyFeedbackPage() {
  const { profile } = useAuth()
  const list = useFeedbackList({ mineOnly: true, userId: profile?.id })
  const [openId, setOpenId] = useState<string | null>(null)
  const [shot, setShot] = useState<Feedback | null>(null)

  return (
    <div>
      <PageHeader title="My Feedback" subtitle="Issues you have reported and their current status."
        actions={<Link to="/feedback" className="btn-primary"><Plus className="h-4 w-4" /> New feedback</Link>} />
      <div className="mb-3"><FilterBar filters={list.filters} onChange={list.patchFilters} showOwner={false} /></div>
      <FeedbackTable
        variant="user" rows={list.rows} total={list.total} loading={list.loading} error={list.error} onRetry={list.reload}
        page={list.page} pageSize={list.pageSize} onPage={list.setPage} onPageSize={list.changePageSize}
        sortBy={list.sortBy} sortDir={list.sortDir} onSort={list.onSort}
        onOpen={(r) => setOpenId(r.id)} onViewScreenshot={setShot} hasFilters={list.hasFilters}
        emptyTitle="You haven't reported any validation issues yet." emptyDescription="Use “Feedback” to report your first issue."
      />
      <FeedbackDrawer feedbackId={openId} mode="user" onClose={() => setOpenId(null)} onChanged={list.reload} />
      <ScreenshotViewer path={shot?.screenshot_path ?? null} title={shot?.feedback_number ?? ''} onClose={() => setShot(null)} />
    </div>
  )
}
