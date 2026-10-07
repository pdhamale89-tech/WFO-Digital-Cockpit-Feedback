import type { ReactNode } from 'react'

export function FormField({ label, htmlFor, error, hint, required, children }: {
  label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

export function FormSection({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="card p-5" aria-labelledby={`sec-${step}`}>
      <h2 id={`sec-${step}`} className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-brand-fg" aria-hidden="true">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}
