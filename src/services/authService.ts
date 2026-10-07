import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

/**
 * Auth entry points live here so an enterprise SSO provider can be added without touching UI code,
 * e.g. `signInWithSso('azure')` -> supabase.auth.signInWithOAuth({ provider: 'azure', ... })
 * once the provider is enabled in the Supabase dashboard.
 */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signInWithSso(provider: 'azure') {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

/** Role is read from the database-controlled profiles table, never from user-editable metadata. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}
