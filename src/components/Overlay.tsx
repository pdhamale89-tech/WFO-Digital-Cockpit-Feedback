import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  label: string
  variant?: 'modal' | 'drawer' | 'fullscreen'
  className?: string
  children: ReactNode
}

const stack: object[] = []
const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Accessible modal/drawer shell: focus trap, Escape to close, scroll lock, focus restore. */
export function Overlay({ open, onClose, label, variant = 'modal', className, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = panel.current
    ;(el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus()

    const token = {}
    stack.push(token)
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return // only the top-most overlay reacts
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null)
        if (items.length === 0) { e.preventDefault(); return }
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      stack.splice(stack.indexOf(token), 1)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', variant === 'drawer' ? 'justify-end' : 'items-center justify-center p-4')}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col bg-surface text-fg shadow-2xl outline-none',
          variant === 'drawer' && 'h-full w-full max-w-xl border-l border-border sm:max-w-2xl',
          variant === 'modal' && 'max-h-[90vh] w-full max-w-md rounded-xl border border-border',
          variant === 'fullscreen' && 'h-[92vh] w-[96vw] rounded-xl border border-border',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
