/**
 * Map any thrown value to a safe, user-friendly message.
 * Raw database / API errors are logged to the console (dev only) and never shown to users.
 */
export class UserFacingError extends Error {}

interface ErrorLike { message?: string; code?: string; status?: number; name?: string }

export function toUserMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof UserFacingError) return err.message
  const e = (err ?? {}) as ErrorLike
  const msg = (e.message ?? '').toLowerCase()

  if (import.meta.env.DEV) console.error('[feedback-portal]', err)

  if (e.name === 'TypeError' && (msg.includes('fetch') || msg.includes('network')) || msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Unable to reach the server. Check your connection and try again.'
  }
  if (msg.includes('jwt expired') || e.code === 'PGRST301' || e.status === 401) {
    return 'Your session has expired. Please sign in again.'
  }
  if (msg.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (msg.includes('email not confirmed')) return 'Please confirm your email address before signing in.'
  if (msg.includes('user already registered')) return 'An account with this email already exists.'
  if (msg.includes('rate limit') || e.status === 429) return 'Too many attempts. Please wait a moment and try again.'
  if (e.code === '42501' || e.status === 403 || msg.includes('row-level security') || msg.includes('not allowed') || msg.includes('forbidden')) {
    return 'You do not have permission to perform this action.'
  }
  if (msg.includes('screenshot is required')) return 'A screenshot is required.'
  if (msg.includes('exceeded the maximum allowed size') || e.status === 413) return 'The file is too large (maximum 10 MB).'
  if (msg.includes('mime type') || msg.includes('invalid_mime_type')) return 'Unsupported file type. Use PNG, JPG, JPEG or WEBP.'
  return fallback
}
