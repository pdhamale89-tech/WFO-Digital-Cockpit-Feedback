import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState, LoadingState } from './States'
import { Link } from 'react-router-dom'

/** UX gate only — the database (RLS) is the real authorization boundary. */
export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { loading, session, profile, isAdmin } = useAuth()
  const loc = useLocation()

  if (loading) return <div className="p-8"><LoadingState /></div>
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  if (!profile) {
    return <EmptyState icon={ShieldAlert} title="Your profile is not available"
      description="Your account is signed in but has no profile yet. Please sign out and in again, or contact the administrator." />
  }
  if (adminOnly && !isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} title="Access denied" description="You do not have permission to view this page."
        action={<Link className="btn-primary" to="/feedback">Back to feedback</Link>} />
    )
  }
  return <Outlet />
}
