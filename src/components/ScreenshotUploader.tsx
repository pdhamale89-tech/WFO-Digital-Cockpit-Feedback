import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { ACCEPTED_IMAGE_EXT, ACCEPTED_IMAGE_TYPES } from '@/lib/constants'
import { validateScreenshot } from '@/lib/schemas'
import { cn, formatBytes } from '@/lib/utils'

interface Props {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
  /** 0-100 while uploading, null otherwise */
  progress?: number | null
  disabled?: boolean
}

export function ScreenshotUploader({ value, onChange, error, progress = null, disabled }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value) { setPreview(null); return }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const accept = (file: File | undefined) => {
    if (!file) return
    const err = validateScreenshot(file)
    setLocalError(err)
    if (!err) onChange(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Allow pasting a screenshot straight from the clipboard.
  useEffect(() => {
    if (disabled) return
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'))
      if (f) accept(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  const shownError = localError ?? error
  const uploading = progress !== null && progress < 100

  return (
    <div>
      {!value ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) accept(e.dataTransfer.files[0]) }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragging ? 'border-brand bg-brand-soft' : 'border-border bg-muted/50 hover:border-brand hover:bg-brand-soft',
            shownError && 'border-red-500',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          <UploadCloud className="h-8 w-8 text-brand" aria-hidden="true" />
          <span className="font-semibold">Drag &amp; drop a screenshot, or <span className="text-brand underline">browse</span></span>
          <span className="text-xs text-subtle">You can also paste from the clipboard · PNG, JPG, JPEG, WEBP · max 10 MB</span>
        </label>
      ) : (
        <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
            {preview ? <img src={preview} alt={`Preview of ${value.name}`} className="h-full w-full object-contain" /> : <ImagePlus className="text-subtle" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              <p className="truncate font-semibold" title={value.name}>{value.name}</p>
              <p className="text-xs text-subtle">{formatBytes(value.size)} · {value.type.replace('image/', '').toUpperCase()}</p>
            </div>
            {progress !== null ? (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-subtle">{uploading ? `Uploading… ${progress}%` : 'Uploaded'}</p>
              </div>
            ) : (
              <div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => { onChange(null); setLocalError(null) }} disabled={disabled}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_IMAGE_EXT].join(',')}
        onChange={(e) => accept(e.target.files?.[0])}
        disabled={disabled}
        aria-label="Screenshot of error"
      />
      {shownError && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{shownError}</p>}
    </div>
  )
}
