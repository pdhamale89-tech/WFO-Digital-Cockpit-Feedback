import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ToastNotification, type ToastItem, type ToastKind } from '@/components/ToastNotification'

interface ToastApi {
  toast: (kind: ToastKind, title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const toast = useCallback<ToastApi['toast']>((kind, title, description) => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l.slice(-3), { id, kind, title, description }])
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000)
  }, [dismiss])

  const api = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastNotification items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
