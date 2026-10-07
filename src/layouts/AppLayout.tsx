import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, ClipboardList, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquarePlus, Moon, Settings, Sun, UserCircle, X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

const USER_NAV: NavItem[] = [
  { to: '/feedback', label: 'Feedback', icon: MessageSquarePlus },
  { to: '/my-feedback', label: 'My Feedback', icon: ClipboardList },
  { to: '/settings', label: 'Profile', icon: UserCircle },
]
const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Feedback Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/all', label: 'All Feedback', icon: ListChecks },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]
const ADMIN_EXTRA: NavItem[] = [
  { to: '/feedback', label: 'Submit Feedback', icon: MessageSquarePlus },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-fg" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"><path d="M4 18V6h3l5 8 5-8h3v12" /></svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">WFO Digital Cockpit</p>
        <p className="text-[11px] text-subtle">Feedback &amp; Validation</p>
      </div>
    </div>
  )
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-brand-soft text-brand' : 'text-subtle hover:bg-muted hover:text-fg')}>
          <i.icon className="h-4 w-4" aria-hidden="true" />{i.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const items = isAdmin ? [...ADMIN_NAV, ...ADMIN_EXTRA] : USER_NAV

  return (
    <div className="flex h-full min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface p-3 lg:flex">
        <div className="px-2 pb-5 pt-2"><Logo /></div>
        <NavList items={items} />
        <div className="mt-auto border-t border-border px-2 pt-3 text-xs text-subtle">
          <p className="truncate font-semibold text-fg">{profile?.name}</p>
          <p className="truncate">{profile?.email}</p>
          <p className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-semibold uppercase">{profile?.role}</p>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="relative h-full w-64 bg-surface p-3 shadow-xl">
            <div className="flex items-center justify-between px-2 pb-5 pt-2">
              <Logo />
              <button className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            </div>
            <NavList items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu className="h-5 w-5" /></button>
            <div className="lg:hidden"><Logo /></div>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-ghost btn-sm" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1800px] flex-1 p-4 sm:p-6">
          <ErrorBoundary key={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
