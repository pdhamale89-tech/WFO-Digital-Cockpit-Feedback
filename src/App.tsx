import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/hooks/useToast'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { EmptyState, LoadingState } from '@/components/States'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { AdminFeedbackPage } from '@/pages/AdminFeedbackPage'
const AnalyticsPage = lazyWithRetry(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
import { FeedbackPage } from '@/pages/FeedbackPage'
import { LoginPage } from '@/pages/LoginPage'
import { MyFeedbackPage } from '@/pages/MyFeedbackPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { Link } from 'react-router-dom'

function Home() {
  const { loading, session, isAdmin } = useAuth()
  if (loading) return <LoadingState />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/feedback'} replace />
}

function NotFound() {
  return <EmptyState title="Page not found" description="The page you are looking for does not exist." action={<Link to="/" className="btn-primary">Go home</Link>} />
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Home />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/my-feedback" element={<MyFeedbackPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route element={<ProtectedRoute adminOnly />}>
                  <Route path="/admin/analytics" element={<Suspense fallback={<LoadingState />}><AnalyticsPage /></Suspense>} />
                  <Route path="/admin" element={<AdminFeedbackPage />} />
                  <Route path="/admin/all" element={<AdminFeedbackPage />} />
                  <Route path="/admin/feedback/:id" element={<AdminFeedbackPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
