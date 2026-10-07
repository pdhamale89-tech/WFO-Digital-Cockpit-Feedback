import { supabase, supabaseKey } from '@/lib/supabase'
import { SCREENSHOT_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/constants'

const EXT_BY_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/** Upload to the PRIVATE bucket under <userId>/<uuid>.<ext>, reporting progress. Returns the storage path. */
export async function uploadScreenshot(
  userId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = EXT_BY_MIME[file.type] ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('Could not start upload')

  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token ?? supabaseKey

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', data.signedUrl)
    xhr.setRequestHeader('apikey', supabaseKey)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(Object.assign(new Error(xhr.responseText || 'Upload failed'), { status: xhr.status }))
    }
    xhr.onerror = () => reject(new TypeError('Failed to fetch'))
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)
    xhr.send(body)
  })
  onProgress?.(100)
  return path
}

/** Short-lived signed URL. Access is still gated by Storage RLS (own folder or admin). */
export async function getSignedUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, download ? { download } : undefined)
  if (error || !data) throw error ?? new Error('Could not load screenshot')
  return data.signedUrl
}

export async function removeScreenshot(path: string): Promise<void> {
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path])
}
