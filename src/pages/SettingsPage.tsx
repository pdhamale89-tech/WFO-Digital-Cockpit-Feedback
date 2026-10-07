import { useState, type FormEvent } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/States'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { toUserMessage } from '@/lib/errors'
import {
  addAdminEmail, addOwner, deleteOwner, getScreenshotRequired, listAdminEmails, listOwners,
  removeAdminEmail, setOwnerActive, setScreenshotRequired, updateProfileName,
} from '@/services/feedbackService'

function ProfileCard() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(profile?.name ?? '')
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !name.trim()) return
    setBusy(true)
    try { await updateProfileName(profile.id, name); await refreshProfile(); toast('success', 'Profile updated') }
    catch (err) { toast('error', 'Could not update profile', toUserMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <section className="card p-5" aria-labelledby="s-profile">
      <h2 id="s-profile" className="mb-3 text-sm font-semibold">Profile</h2>
      <form onSubmit={save} className="grid gap-3 sm:max-w-md">
        <div><label className="field-label" htmlFor="p-name">Name</label><input id="p-name" className="field-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="p-email">Email</label><input id="p-email" className="field-input" value={profile?.email ?? ''} disabled /></div>
        <div><label className="field-label" htmlFor="p-role">Role</label><input id="p-role" className="field-input capitalize" value={profile?.role ?? ''} disabled /></div>
        <div><button className="btn-primary" disabled={busy || !name.trim() || name.trim() === profile?.name}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</button></div>
      </form>
    </section>
  )
}

function OwnersCard() {
  const { toast } = useToast()
  const owners = useAsync(() => listOwners(true), [])
  const [newName, setNewName] = useState('')
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); owners.reload(); toast('success', ok) }
    catch (e) { toast('error', 'Action failed', toUserMessage(e, 'Could not complete the action. The name may already exist.')) }
    finally { setBusy(false); setToDelete(null) }
  }

  return (
    <section className="card p-5" aria-labelledby="s-owners">
      <h2 id="s-owners" className="text-sm font-semibold">Owners</h2>
      <p className="mb-3 text-subtle">People or teams that feedback can be assigned to. Deactivate to hide from new assignments without losing history.</p>
      <form className="mb-3 flex gap-2 sm:max-w-md" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) void run(async () => { await addOwner(newName); setNewName('') }, 'Owner added') }}>
        <label htmlFor="o-new" className="sr-only">New owner name</label>
        <input id="o-new" className="field-input" placeholder="Add owner (e.g. Priya – BI Developer)" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary" disabled={busy || !newName.trim()}><Plus className="h-4 w-4" /> Add</button>
      </form>
      {owners.loading && !owners.data ? <LoadingState variant="table" rows={4} />
        : owners.error ? <ErrorState message={owners.error} onRetry={owners.reload} />
        : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(owners.data ?? []).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className={o.active ? '' : 'text-subtle line-through'}>{o.name}</span>
                <span className="flex items-center gap-1">
                  <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => setOwnerActive(o.id, !o.active), o.active ? 'Owner deactivated' : 'Owner activated')}>
                    {o.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn-ghost btn-sm text-red-600" disabled={busy} aria-label={`Delete ${o.name}`} onClick={() => setToDelete(o)}><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      <ConfirmDialog open={!!toDelete} danger busy={busy} title="Delete owner?" message={`“${toDelete?.name}” will be removed from the owner list. Existing feedback keeps its assigned owner text.`}
        confirmLabel="Delete" onCancel={() => setToDelete(null)} onConfirm={() => toDelete && void run(() => deleteOwner(toDelete.id), 'Owner deleted')} />
    </section>
  )
}

function ScreenshotCard() {
  const { toast } = useToast()
  const cfg = useAsync(getScreenshotRequired, [])
  const [busy, setBusy] = useState(false)
  const toggle = async (v: boolean) => {
    setBusy(true)
    try { await setScreenshotRequired(v); cfg.reload(); toast('success', v ? 'Screenshots are now required' : 'Screenshots are now optional') }
    catch (e) { toast('error', 'Could not update setting', toUserMessage(e)) }
    finally { setBusy(false) }
  }
  return (
    <section className="card p-5" aria-labelledby="s-shot">
      <h2 id="s-shot" className="mb-2 text-sm font-semibold">Feedback form</h2>
      {cfg.error ? <ErrorState message={cfg.error} onRetry={cfg.reload} /> : (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={cfg.data ?? true} disabled={busy || cfg.loading} onChange={(e) => void toggle(e.target.checked)} />
          <span>Require a screenshot when submitting feedback</span>
        </label>
      )}
    </section>
  )
}

function AdminsCard() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const admins = useAsync(listAdminEmails, [])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); admins.reload(); toast('success', ok) }
    catch (e) { toast('error', 'Action failed', toUserMessage(e, 'Could not complete the action.')) }
    finally { setBusy(false) }
  }

  return (
    <section className="card p-5" aria-labelledby="s-admins">
      <h2 id="s-admins" className="text-sm font-semibold">Administrators</h2>
      <p className="mb-3 text-subtle">Users with these emails get the admin role. Stored in the database and enforced by Row Level Security.</p>
      <form className="mb-3 flex gap-2 sm:max-w-md" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void run(async () => { await addAdminEmail(email); setEmail('') }, 'Administrator added') }}>
        <label htmlFor="a-new" className="sr-only">Administrator email</label>
        <input id="a-new" type="email" className="field-input" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary" disabled={busy || !email.trim()}><Plus className="h-4 w-4" /> Add</button>
      </form>
      {admins.loading && !admins.data ? <LoadingState variant="table" rows={2} />
        : admins.error ? <ErrorState message={admins.error} onRetry={admins.reload} />
        : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(admins.data ?? []).map((a) => (
              <li key={a} className="flex items-center justify-between px-3 py-2">
                <span>{a}</span>
                {a !== profile?.email.toLowerCase() && (
                  <button className="btn-ghost btn-sm text-red-600" disabled={busy} aria-label={`Remove ${a}`} onClick={() => void run(() => removeAdminEmail(a), 'Administrator removed')}><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}

export function SettingsPage() {
  const { isAdmin } = useAuth()
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={isAdmin ? 'Settings' : 'Profile'} subtitle={isAdmin ? 'Portal configuration and your profile.' : 'Your account details.'} />
      <ProfileCard />
      {isAdmin && <><ScreenshotCard /><OwnersCard /><AdminsCard /></>}
    </div>
  )
}
