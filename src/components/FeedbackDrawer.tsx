import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckCheck, Loader2, Pencil, Save, Trash2, X } from 'lucide-react'
import { FEEDBACK_TYPES, PRIORITIES, STATUSES, STATUS_TRANSITIONS } from '@/lib/constants'
import { toUserMessage } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import {
  addUserComment, deleteFeedback, getFeedback, getHistory, updateFeedback, type AdminUpdate,
} from '@/services/feedbackService'
import type { Feedback, FeedbackType, Priority, Status } from '@/types'
import { AuditTimeline } from './AuditTimeline'
import { ConfirmDialog } from './ConfirmDialog'
import { FormField } from './FormField'
import { SearchableSelect } from './SearchableSelect'
import { Overlay } from './Overlay'
import { ScreenshotViewer, useSignedUrl } from './ScreenshotViewer'
import { PriorityBadge, StatusBadge } from './StatusBadge'
import { ErrorState, LoadingState } from './States'

interface Props {
  feedbackId: string | null
  mode: 'admin' | 'user'
  owners?: string[]
  assignees?: string[]
  onClose: () => void
  /** Called after any change/delete so the list can refresh */
  onChanged: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

export function FeedbackDrawer({ feedbackId, mode, owners = [], assignees = [], onClose, onChanged }: Props) {
  const open = feedbackId !== null
  return (
    <Overlay open={open} onClose={onClose} label="Feedback details" variant="drawer">
      {feedbackId && <DrawerBody key={feedbackId} id={feedbackId} mode={mode} owners={owners} assignees={assignees} onClose={onClose} onChanged={onChanged} />}
    </Overlay>
  )
}

function DrawerBody({ id, mode, owners, assignees, onClose, onChanged }: { id: string; mode: 'admin' | 'user'; owners: string[]; assignees: string[]; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast()
  const detail = useAsync(() => getFeedback(id), [id])
  const history = useAsync(() => (mode === 'admin' ? getHistory(id) : Promise.resolve([])), [id, mode])
  const [fb, setFb] = useState<Feedback | null>(null)
  const [draft, setDraft] = useState({ status: 'New' as Status, owner: '', sub_owner: '', eta: '', challenges: '', priority: 'Medium' as Priority, admin_comments: '', resolution: '' })
  const [edit, setEdit] = useState(false)
  const [editFields, setEditFields] = useState({ card_graph_name: '', feedback_type: 'Other' as FeedbackType, changes_required: '' })
  const [userComment, setUserComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewShot, setViewShot] = useState(false)

  const hydrate = (f: Feedback) => {
    setFb(f)
    setDraft({ status: f.status, owner: f.owner ?? '', sub_owner: f.sub_owner ?? '', eta: f.eta ?? '', challenges: f.challenges ?? '', priority: f.priority, admin_comments: f.admin_comments ?? '', resolution: f.resolution ?? '' })
    setEditFields({ card_graph_name: f.card_graph_name, feedback_type: f.feedback_type, changes_required: f.changes_required })
    setUserComment(f.user_comments ?? '')
  }
  useEffect(() => { if (detail.data) hydrate(detail.data) }, [detail.data])

  const shot = useSignedUrl(fb?.screenshot_path, fb !== null)

  const statusOptions = useMemo<readonly Status[]>(
    () => (fb ? [fb.status, ...STATUS_TRANSITIONS[fb.status]] : STATUSES),
    [fb],
  )

  const apply = async (patch: AdminUpdate, okMsg: string) => {
    if (!fb) return
    setSaving(true)
    try {
      const updated = await updateFeedback(fb.id, patch)
      hydrate(updated)
      setEdit(false)
      history.reload()
      onChanged()
      toast('success', okMsg)
    } catch (e) {
      toast('error', 'Could not save changes', toUserMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!fb) return
    const patch: AdminUpdate = {}
    if (draft.status !== fb.status) patch.status = draft.status
    if ((draft.owner || null) !== fb.owner) patch.owner = draft.owner || null
    if (draft.priority !== fb.priority) patch.priority = draft.priority
    if ((draft.sub_owner.trim() || null) !== (fb.sub_owner || null)) patch.sub_owner = draft.sub_owner.trim() || null
    if ((draft.eta || null) !== (fb.eta || null)) patch.eta = draft.eta || null
    if ((draft.challenges.trim() || null) !== (fb.challenges || null)) patch.challenges = draft.challenges.trim() || null
    if ((draft.admin_comments || null) !== (fb.admin_comments || null)) patch.admin_comments = draft.admin_comments.trim() || null
    if ((draft.resolution || null) !== (fb.resolution || null)) patch.resolution = draft.resolution.trim() || null
    if (edit) {
      if (editFields.card_graph_name.trim() !== fb.card_graph_name) patch.card_graph_name = editFields.card_graph_name.trim()
      if (editFields.feedback_type !== fb.feedback_type) patch.feedback_type = editFields.feedback_type
      if (editFields.changes_required.trim() !== fb.changes_required) patch.changes_required = editFields.changes_required.trim()
    }
    if (Object.keys(patch).length === 0) { toast('info', 'No changes to save'); return }
    void apply(patch, 'Changes saved')
  }

  const saveUserComment = async () => {
    if (!fb) return
    setSaving(true)
    try {
      hydrate(await addUserComment(fb.id, userComment.trim()))
      onChanged()
      toast('success', 'Comment saved')
    } catch (e) {
      toast('error', 'Could not save your comment', toUserMessage(e))
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!fb) return
    setSaving(true)
    try {
      await deleteFeedback(fb)
      toast('success', `${fb.feedback_number} deleted`)
      onChanged()
      onClose()
    } catch (e) {
      toast('error', 'Could not delete feedback', toUserMessage(e))
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  const dirty = fb && (
    draft.status !== fb.status || (draft.owner || null) !== fb.owner || draft.priority !== fb.priority ||
    (draft.sub_owner.trim() || null) !== (fb.sub_owner || null) || (draft.eta || null) !== (fb.eta || null) || (draft.challenges.trim() || null) !== (fb.challenges || null) ||
    (draft.admin_comments || null) !== (fb.admin_comments || null) || (draft.resolution || null) !== (fb.resolution || null) ||
    (edit && (editFields.card_graph_name.trim() !== fb.card_graph_name || editFields.feedback_type !== fb.feedback_type || editFields.changes_required.trim() !== fb.changes_required))
  )

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-brand">{fb?.feedback_number ?? 'Loading…'}</p>
          <h2 className="truncate text-lg font-semibold">{fb?.card_graph_name ?? ' '}</h2>
        </div>
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close details" data-autofocus><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {detail.loading && !fb && <LoadingState variant="drawer" />}
        {detail.error && <ErrorState message={detail.error} onRetry={detail.reload} />}
        {!detail.loading && !detail.error && !fb && <ErrorState message="This feedback could not be found, or you do not have access to it." />}
        {fb && (
          <div className="space-y-6 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={fb.status} />
              <PriorityBadge priority={fb.priority} />
              {fb.dashboard_path && <span className="w-full text-xs font-medium">{fb.dashboard_path}</span>}
              <span className="text-xs text-subtle">{fb.business ? `${fb.business} · ` : ''}{fb.component_category} · {fb.feedback_type}</span>
            </div>

            <section aria-labelledby="d-issue">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="d-issue" className="text-sm font-semibold">Issue</h3>
                {mode === 'admin' && !edit && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Edit</button>}
              </div>
              {edit ? (
                <div className="space-y-3">
                  <FormField label="Cards / Graph name" htmlFor="e-name"><input id="e-name" className="field-input" value={editFields.card_graph_name} maxLength={200} onChange={(e) => setEditFields({ ...editFields, card_graph_name: e.target.value })} /></FormField>
                  <FormField label="Feedback type" htmlFor="e-type">
                    <select id="e-type" className="field-input" value={editFields.feedback_type} onChange={(e) => setEditFields({ ...editFields, feedback_type: e.target.value as FeedbackType })}>
                      {FEEDBACK_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Changes required" htmlFor="e-changes"><textarea id="e-changes" rows={5} className="field-input" value={editFields.changes_required} maxLength={5000} onChange={(e) => setEditFields({ ...editFields, changes_required: e.target.value })} /></FormField>
                  <button className="btn-ghost btn-sm" onClick={() => { setEdit(false); hydrate(fb) }}>Cancel edit</button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap rounded-lg bg-muted p-3">{fb.changes_required}</p>
              )}
            </section>

            <section aria-labelledby="d-shot">
              <h3 id="d-shot" className="mb-2 text-sm font-semibold">Screenshot</h3>
              {!fb.screenshot_path && <p className="text-subtle">No screenshot attached.</p>}
              {fb.screenshot_path && shot.loading && <div className="skeleton h-40 w-full" />}
              {shot.error && <p className="text-red-600 dark:text-red-400" role="alert">{shot.error}</p>}
              {shot.url && (
                <button className="group relative block w-full overflow-hidden rounded-lg border border-border bg-muted" onClick={() => setViewShot(true)} aria-label="Open screenshot full size">
                  <img src={shot.url} loading="lazy" alt={`Screenshot of the reported issue for ${fb.card_graph_name}`} className="max-h-64 w-full object-contain" />
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Click to enlarge</span>
                </button>
              )}
            </section>

            <dl className="grid grid-cols-2 gap-4 border-y border-border py-4">
              <Row label="Reported by">{fb.reported_by_name}<br /><span className="text-xs text-subtle">{fb.reported_by_email}</span></Row>
              <Row label="Owner">{fb.owner ?? <span className="text-subtle">Unassigned</span>}</Row>
              <Row label="Sub owner">{fb.sub_owner ?? <span className="text-subtle">—</span>}</Row>
              <Row label="ETA">{fb.eta ? formatDate(`${fb.eta}T00:00:00`) : '—'}</Row>
              <Row label="Date reported">{formatDateTime(fb.date_reported)}</Row>
              <Row label="Date completed">{fb.status === 'Completed' ? formatDateTime(fb.date_completed) : '—'}</Row>
            </dl>

            {mode === 'admin' ? (
              <section aria-labelledby="d-actions" className="space-y-4">
                <h3 id="d-actions" className="text-sm font-semibold">Triage</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Status" htmlFor="a-status">
                    <select id="a-status" className="field-input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>
                      {statusOptions.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Owner" htmlFor="a-owner">
                    <SearchableSelect id="a-owner" value={draft.owner} onChange={(v) => setDraft({ ...draft, owner: v })}
                      options={[...new Set([...(fb.owner ? [fb.owner] : []), ...owners])]} placeholder="Search owner…" emptyLabel="No owners found" />
                  </FormField>
                  <FormField label="Priority" htmlFor="a-priority">
                    <select id="a-priority" className="field-input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
                      {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Sub owner name" htmlFor="a-subowner">
                    <SearchableSelect id="a-subowner" value={draft.sub_owner} onChange={(v) => setDraft({ ...draft, sub_owner: v })}
                      options={[...new Set([...(fb.sub_owner ? [fb.sub_owner] : []), ...assignees])]} placeholder="Search assignee…" emptyLabel="No assignees found" />
                  </FormField>
                  <FormField label="ETA" htmlFor="a-eta">
                    <input id="a-eta" type="date" className="field-input" value={draft.eta} onChange={(e) => setDraft({ ...draft, eta: e.target.value })} />
                  </FormField>
                </div>
                <FormField label="Challenges if any" htmlFor="a-challenges">
                  <textarea id="a-challenges" rows={2} className="field-input" maxLength={5000} value={draft.challenges} onChange={(e) => setDraft({ ...draft, challenges: e.target.value })} />
                </FormField>
                <FormField label="Admin comments" htmlFor="a-comments" hint="Visible to the reporter on their feedback.">
                  <textarea id="a-comments" rows={3} className="field-input" value={draft.admin_comments} onChange={(e) => setDraft({ ...draft, admin_comments: e.target.value })} maxLength={5000} />
                </FormField>
                <FormField label="Resolution" htmlFor="a-resolution">
                  <textarea id="a-resolution" rows={3} className="field-input" value={draft.resolution} onChange={(e) => setDraft({ ...draft, resolution: e.target.value })} maxLength={5000} />
                </FormField>
                {fb.user_comments && <Row label="Reporter's follow-up comment">{fb.user_comments}</Row>}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
                  </button>
                  {fb.status !== 'Completed' && (
                    <button className="btn-secondary" disabled={saving}
                      onClick={() => void apply({ status: 'Completed', owner: draft.owner || null, priority: draft.priority,
                        admin_comments: draft.admin_comments.trim() || null, resolution: draft.resolution.trim() || null }, `${fb.feedback_number} marked completed`)}>
                      <CheckCheck className="h-4 w-4" /> Mark Completed
                    </button>
                  )}
                  <button className="btn-ghost ml-auto text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950" onClick={() => setConfirmDelete(true)} disabled={saving}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </section>
            ) : (
              <section className="space-y-4" aria-label="Team response">
                <Row label="Comments from the team">{fb.admin_comments || <span className="text-subtle">No comments yet.</span>}</Row>
                <Row label="Challenges">{fb.challenges || <span className="text-subtle">None noted.</span>}</Row>
                <Row label="Resolution">{fb.resolution || <span className="text-subtle">Not yet resolved.</span>}</Row>
                <FormField label="Add a follow-up comment" htmlFor="u-comment" hint="Shared with the validation/development team.">
                  <textarea id="u-comment" rows={3} className="field-input" maxLength={2000} value={userComment} onChange={(e) => setUserComment(e.target.value)} />
                </FormField>
                <button className="btn-primary" onClick={saveUserComment} disabled={saving || userComment.trim() === (fb.user_comments ?? '')}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save comment
                </button>
              </section>
            )}

            {mode === 'admin' && (
              <section aria-labelledby="d-history">
                <h3 id="d-history" className="mb-3 text-sm font-semibold">Audit history</h3>
                {history.loading && !history.data ? <LoadingState variant="table" rows={3} />
                  : history.error ? <ErrorState message={history.error} onRetry={history.reload} />
                  : <AuditTimeline entries={history.data ?? []} />}
              </section>
            )}
          </div>
        )}
      </div>

      <ScreenshotViewer path={viewShot ? fb?.screenshot_path ?? null : null} title={fb?.feedback_number ?? 'screenshot'} onClose={() => setViewShot(false)} />
      <ConfirmDialog open={confirmDelete} danger busy={saving} title="Delete this feedback?"
        message={`${fb?.feedback_number ?? 'This record'} and its screenshot will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </>
  )
}
