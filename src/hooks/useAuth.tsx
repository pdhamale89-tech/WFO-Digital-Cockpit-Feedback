import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { fetchProfile, signOut as doSignOut } from '@/services/authService'
import type { Profile } from '@/types'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  /** Set when the session ended unexpectedly (expiry / revoked) so the login page can explain it. */
  sessionExpired: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [sessionExpired, setSessionExpired] = useState(false)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      return
    }
    try {
      setProfile(await fetchProfile(s.user.id))
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        // SIGNED_OUT without an explicit sign-out click means expiry/revocation.
        if (!sessionStorage.getItem('manual-signout')) setSessionExpired(true)
        sessionStorage.removeItem('manual-signout')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSessionExpired(false)
        // Defer: calling supabase inside the callback can deadlock auth-js.
        setTimeout(() => void loadProfile(s), 0)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    sessionStorage.setItem('manual-signout', '1')
    await doSignOut()
    setSessionExpired(false)
  }, [])

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session])

  const value = useMemo<AuthState>(
    () => ({ loading, session, profile, isAdmin: profile?.role === 'admin', sessionExpired, signOut, refreshProfile }),
    [loading, session, profile, sessionExpired, signOut, refreshProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
