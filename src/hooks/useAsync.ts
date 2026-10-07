import { useCallback, useEffect, useRef, useState } from 'react'
import { toUserMessage } from '@/lib/errors'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

/** Minimal data-loading hook: ignores stale responses, exposes a user-safe error message. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    fn()
      .then((d) => { if (id === reqId.current) { setData(d); setError(null) } })
      .catch((e) => { if (id === reqId.current) setError(toUserMessage(e, 'Could not load data. Please try again.')) })
      .finally(() => { if (id === reqId.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}
