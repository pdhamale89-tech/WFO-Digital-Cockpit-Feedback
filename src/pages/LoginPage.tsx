import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2, LogIn } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginValues } from '@/lib/schemas'
import { toUserMessage } from '@/lib/errors'
import { isSupabaseConfigured } from '@/lib/supabase'
import { signInWithPassword, signUpWithPassword } from '@/services/authService'
import { FormField } from '@/components/FormField'
import { LoadingState } from '@/components/States'

export function LoginPage() {
  const { loading, session, profile, isAdmin, sessionExpired } = useAuth()
  const loc = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (loading) return <div className="p-8"><LoadingState /></div>
  if (session && profile) {
    const from = (loc.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : isAdmin ? '/admin' : '/feedback'} replace />
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null); setInfo(null)
    try {
      if (mode === 'signin') await signInWithPassword(email, password)
      else {
        const { needsConfirmation } = await signUpWithPassword(email, password, name)
        if (needsConfirmation) setInfo('Account created. Check your email to confirm your address, then sign in.')
      }
    } catch (e) {
      setError(toUserMessage(e, mode === 'signin' ? 'Sign-in failed. Please try again.' : 'Could not create the account. Please try again.'))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-bg to-bg p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-fg" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"><path d="M4 18V6h3l5 8 5-8h3v12" /></svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">WFO Digital Cockpit</h1>
          <p className="text-subtle">Feedback &amp; Validation Portal</p>
        </div>

        {!isSupabaseConfigured && (
          <p role="alert" className="mb-4 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and set the project URL and publishable key.
          </p>
        )}
        {sessionExpired && (
          <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Your session has expired. Please sign in again.
          </p>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {mode === 'signup' && (
            <FormField label="Full name" htmlFor="name">
              <input id="name" className="field-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          )}
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" className="field-input" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Password" htmlFor="password" error={errors.password?.message}>
            <input id="password" type="password" className="field-input" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
          {info && <p role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">{info}</p>}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting || !isSupabaseConfigured}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-subtle">
          {mode === 'signin' ? 'New to the portal?' : 'Already have an account?'}{' '}
          <button className="font-semibold text-brand underline" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
