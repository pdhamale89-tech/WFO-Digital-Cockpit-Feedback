import { lazy, type ComponentType } from 'react'

const FLAG = 'chunk-reloaded'

/**
 * React.lazy that survives a redeploy: if the code-split file is gone (stale cached index.html after a new
 * release), reload once to pick up the new build instead of leaving a blank page.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load()
      try { sessionStorage.removeItem(FLAG) } catch { /* ignore */ }
      return mod
    } catch (err) {
      let alreadyReloaded = true
      try { alreadyReloaded = sessionStorage.getItem(FLAG) === '1'; if (!alreadyReloaded) sessionStorage.setItem(FLAG, '1') } catch { /* ignore */ }
      if (!alreadyReloaded) {
        window.location.reload()
        return new Promise<never>(() => undefined) // page is reloading
      }
      throw err
    }
  })
}
