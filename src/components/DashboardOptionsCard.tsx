import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { BUSINESSES } from '@/lib/constants'
import { toUserMessage } from '@/lib/errors'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import {
  addDashboardOption, deleteDashboardOption, listDashboardOptions, renameDashboardOption, setDashboardOptionActive,
} from '@/services/feedbackService'
import type { Business, DashboardOption } from '@/types'
import { childrenOf, levelLabel } from '@/utils/tree'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorState, LoadingState } from './States'

interface NodeProps {
  opt: DashboardOption
  all: DashboardOption[]
  depth: number
  busy: boolean
  onAdd: (parent: DashboardOption, name: string) => Promise<boolean>
  onRename: (o: DashboardOption, name: string) => Promise<boolean>
  onToggle: (o: DashboardOption) => void
  onDelete: (o: DashboardOption) => void
}

function OptionNode({ opt, all, depth, busy, onAdd, onRename, onToggle, onDelete }: NodeProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const kids = childrenOf(all, opt.business, opt.id, false)

  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 border-b border-border py-1.5" style={{ paddingLeft: depth * 20 }}>
        {editing ? (
          <form className="flex gap-1" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && await onRename(opt, text)) setEditing(false) }}>
            <input aria-label="Rename option" className="field-input h-8 py-1" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} autoFocus />
            <button className="btn-primary btn-sm" aria-label="Save name"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" className="btn-ghost btn-sm" aria-label="Cancel" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></button>
          </form>
        ) : (
          <>
            <span className={opt.active ? 'font-medium' : 'text-subtle line-through'}>{opt.name}</span>
            <span className="text-xs text-subtle">{levelLabel(depth)}</span>
            <span className="ml-auto flex items-center gap-1">
              <button className="btn-ghost btn-sm" disabled={busy} onClick={() => { setAdding((a) => !a); setText('') }}>
                <Plus className="h-3.5 w-3.5" /> Add under
              </button>
              <button className="btn-ghost btn-sm" disabled={busy} aria-label={`Rename ${opt.name}`} onClick={() => { setEditing(true); setText(opt.name) }}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button className="btn-secondary btn-sm" disabled={busy} onClick={() => onToggle(opt)}>{opt.active ? 'Deactivate' : 'Activate'}</button>
              <button className="btn-ghost btn-sm text-red-600" disabled={busy} aria-label={`Delete ${opt.name}`} onClick={() => onDelete(opt)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </>
        )}
      </div>
      {adding && (
        <form className="flex gap-2 py-2" style={{ paddingLeft: (depth + 1) * 20 }}
          onSubmit={async (e) => { e.preventDefault(); if (text.trim() && await onAdd(opt, text)) { setText(''); setAdding(false) } }}>
          <input aria-label={`New ${levelLabel(depth + 1).toLowerCase()} under ${opt.name}`} className="field-input h-8 max-w-xs py-1"
            placeholder={`New ${levelLabel(depth + 1).toLowerCase()} name`} value={text} maxLength={80} onChange={(e) => setText(e.target.value)} autoFocus />
          <button className="btn-primary btn-sm" disabled={busy || !text.trim()}>Add</button>
        </form>
      )}
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <OptionNode key={k.id} opt={k} all={all} depth={depth + 1} busy={busy} onAdd={onAdd} onRename={onRename} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function DashboardOptionsCard() {
  const { toast } = useToast()
  const opts = useAsync(listDashboardOptions, [])
  const [business, setBusiness] = useState<Business>('Remote')
  const [rootName, setRootName] = useState('')
  const [toDelete, setToDelete] = useState<DashboardOption | null>(null)
  const [busy, setBusy] = useState(false)
  const all = opts.data ?? []
  const roots = childrenOf(all, business, null, false)

  const run = async (fn: () => Promise<void>, ok: string): Promise<boolean> => {
    setBusy(true)
    try { await fn(); opts.reload(); toast('success', ok); return true }
    catch (e) { toast('error', 'Action failed', toUserMessage(e, 'Could not complete the action. The name may already exist at this level.')); return false }
    finally { setBusy(false) }
  }
  const nextOrder = (parent: string | null, b: Business) =>
    childrenOf(all, b, parent, false).reduce((m, o) => Math.max(m, o.sort_order), 0) + 1

  return (
    <section className="card p-5" aria-labelledby="s-dash">
      <h2 id="s-dash" className="text-sm font-semibold">Business dropdowns</h2>
      <p className="mb-3 text-subtle">
        Configure the cascading dropdowns shown under Business on the feedback form (Sub business → Dashboard → Section).
        Deactivate to hide an option without losing history.
      </p>
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Business">
        {BUSINESSES.map((b) => (
          <button key={b} role="tab" aria-selected={b === business} className={b === business ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setBusiness(b)}>{b}</button>
        ))}
      </div>
      <form className="mb-3 flex gap-2 sm:max-w-md"
        onSubmit={async (e) => { e.preventDefault(); if (rootName.trim() && await run(() => addDashboardOption(business, null, rootName, nextOrder(null, business)), 'Option added')) setRootName('') }}>
        <label htmlFor="d-root" className="sr-only">New sub business under {business}</label>
        <input id="d-root" className="field-input" placeholder={`Add sub business under ${business}`} value={rootName} maxLength={80} onChange={(e) => setRootName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !rootName.trim()}><Plus className="h-4 w-4" /> Add</button>
      </form>
      {opts.loading && !opts.data ? <LoadingState variant="table" rows={4} />
        : opts.error ? <ErrorState message={opts.error} onRetry={opts.reload} />
        : roots.length === 0 ? <p className="text-subtle">No options configured for {business} yet.</p>
        : (
          <ul>
            {roots.map((o) => (
              <OptionNode key={o.id} opt={o} all={all} depth={0} busy={busy}
                onAdd={(p, name) => run(() => addDashboardOption(p.business, p.id, name, nextOrder(p.id, p.business)), 'Option added')}
                onRename={(o2, name) => run(() => renameDashboardOption(o2.id, name), 'Renamed')}
                onToggle={(o2) => void run(() => setDashboardOptionActive(o2.id, !o2.active), o2.active ? 'Deactivated' : 'Activated')}
                onDelete={setToDelete} />
            ))}
          </ul>
        )}
      <ConfirmDialog open={!!toDelete} danger busy={busy} title="Delete option?"
        message={`“${toDelete?.name}” and everything under it will be removed from the dropdowns. Existing feedback keeps its saved path.`}
        confirmLabel="Delete" onCancel={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) { await run(() => deleteDashboardOption(toDelete.id), 'Option deleted'); setToDelete(null) } }} />
    </section>
  )
}
