import { useEffect, useState } from 'react'
import { Download, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { getSignedUrl } from '@/services/storageService'
import { toUserMessage } from '@/lib/errors'
import { Overlay } from './Overlay'
import { ErrorState, LoadingState } from './States'

/** Hook: lazily resolve a private screenshot path to a short-lived signed URL. */
export function useSignedUrl(path: string | null | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setUrl(null); setError(null)
    if (!path || !enabled) return
    let active = true
    setLoading(true)
    getSignedUrl(path)
      .then((u) => active && setUrl(u))
      .catch((e) => active && setError(toUserMessage(e, 'Could not load the screenshot.')))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [path, enabled])
  return { url, error, loading }
}

interface Props { path: string | null; title: string; onClose: () => void }

const MIN = 0.25, MAX = 5

export function ScreenshotViewer({ path, title, onClose }: Props) {
  const { url, error, loading } = useSignedUrl(path, path !== null)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState(true)

  useEffect(() => { setZoom(1); setFit(true) }, [path])

  const setZ = (z: number) => { setFit(false); setZoom(Math.min(MAX, Math.max(MIN, z))) }

  const download = async () => {
    if (!path) return
    try {
      const dl = await getSignedUrl(path, `${title.replace(/[^\w.-]+/g, '_')}.${path.split('.').pop() ?? 'png'}`)
      const a = document.createElement('a')
      a.href = dl
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch { /* surfaced via viewer error state on next load */ }
  }

  return (
    <Overlay open={path !== null} onClose={onClose} label={`Screenshot for ${title}`} variant="fullscreen">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="truncate font-semibold">{title}</p>
        <div className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" onClick={() => setZ((fit ? 1 : zoom) - 0.25)} aria-label="Zoom out" disabled={!url}><ZoomOut className="h-4 w-4" /></button>
          <span className="w-12 text-center text-xs tabular-nums text-subtle" aria-live="polite">{fit ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
          <button className="btn-ghost btn-sm" onClick={() => setZ((fit ? 1 : zoom) + 0.25)} aria-label="Zoom in" disabled={!url}><ZoomIn className="h-4 w-4" /></button>
          <button className="btn-ghost btn-sm" onClick={() => { setFit(true); setZoom(1) }} aria-label="Fit to screen" disabled={!url}><Maximize2 className="h-4 w-4" /></button>
          <button className="btn-ghost btn-sm" onClick={download} aria-label="Download screenshot" disabled={!url}><Download className="h-4 w-4" /></button>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close viewer" data-autofocus><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto bg-muted p-4"
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZ((fit ? 1 : zoom) + (e.deltaY < 0 ? 0.15 : -0.15)) } }}
      >
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {url && (
          <div className={fit ? 'flex h-full w-full items-center justify-center' : 'inline-block min-w-full'}>
            <img
              src={url}
              alt={`Screenshot of the reported issue for ${title}`}
              className={fit ? 'max-h-full max-w-full object-contain' : 'max-w-none origin-top-left'}
              style={fit ? undefined : { width: `${zoom * 100}%`, maxWidth: 'none' }}
              draggable={false}
            />
          </div>
        )}
      </div>
    </Overlay>
  )
}
