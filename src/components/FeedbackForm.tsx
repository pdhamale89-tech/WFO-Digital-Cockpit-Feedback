import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BUSINESSES, COMPONENT_CATEGORIES, FEEDBACK_TYPES, PRIORITIES } from '@/lib/constants'
import { buildFeedbackSchema, type FeedbackFormValues } from '@/lib/schemas'
import { toUserMessage } from '@/lib/errors'
import { createFeedback } from '@/services/feedbackService'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { FormField, FormSection } from './FormField'
import { ScreenshotUploader } from './ScreenshotUploader'

const DEFAULTS: Partial<FeedbackFormValues> = {
  business: undefined, component_category: undefined, card_graph_name: '', feedback_type: undefined,
  changes_required: '', priority: 'Medium', screenshot: null,
}

export function FeedbackForm({ screenshotRequired }: { screenshotRequired: boolean }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const schema = useMemo(() => buildFeedbackSchema(screenshotRequired), [screenshotRequired])
  const [progress, setProgress] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<FeedbackFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS as FeedbackFormValues,
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!profile) return
    setSubmitError(null)
    setProgress(values.screenshot ? 0 : null)
    try {
      const res = await createFeedback(values, profile.id, setProgress)
      setDone(res.feedback_number)
      toast('success', `Feedback ${res.feedback_number} submitted successfully.`,
        'Your feedback has been recorded and will be reviewed by the validation/development team.')
      reset(DEFAULTS as FeedbackFormValues)
    } catch (e) {
      setSubmitError(toUserMessage(e, 'We could not submit your feedback. Please try again.'))
    } finally {
      setProgress(null)
    }
  })

  if (done) {
    return (
      <div className="card flex flex-col items-center px-6 py-12 text-center" role="status">
        <CheckCircle2 className="mb-3 h-12 w-12 text-green-600" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Feedback submitted successfully.</h2>
        <p className="mt-1 text-base">Reference: <span className="font-mono font-semibold">{done}</span></p>
        <p className="mt-2 max-w-md text-subtle">Your feedback has been recorded and will be reviewed by the validation/development team.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => setDone(null)}>Report another issue</button>
          <Link className="btn-secondary" to="/my-feedback">View my feedback</Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Report feedback">
      <FormSection step={1} title="Component">
        <div className="mb-4">
          <FormField label="Business" htmlFor="business" required error={errors.business?.message}>
            <select id="business" className="field-input sm:max-w-xs" defaultValue="" aria-invalid={!!errors.business} {...register('business')}>
              <option value="" disabled>Select a business…</option>
              {BUSINESSES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Component type" htmlFor="component_category" required error={errors.component_category?.message}>
            <select id="component_category" className="field-input" defaultValue="" aria-invalid={!!errors.component_category}
              {...register('component_category')}>
              <option value="" disabled>Select a type…</option>
              {COMPONENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Cards / Graph name" htmlFor="card_graph_name" required error={errors.card_graph_name?.message} hint="e.g. Contact Volume Trend">
            <input id="card_graph_name" className="field-input" maxLength={200} placeholder="Specific component name" aria-invalid={!!errors.card_graph_name}
              {...register('card_graph_name')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection step={2} title="Issue">
        <div className="space-y-4">
          <FormField label="Feedback type" htmlFor="feedback_type" required error={errors.feedback_type?.message}>
            <select id="feedback_type" className="field-input sm:max-w-xs" defaultValue="" aria-invalid={!!errors.feedback_type} {...register('feedback_type')}>
              <option value="" disabled>Select a type…</option>
              {FEEDBACK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="Changes required" htmlFor="changes_required" required error={errors.changes_required?.message}>
            <textarea id="changes_required" rows={6} maxLength={5000} className="field-input resize-y"
              placeholder="Describe what is incorrect and what change is required." aria-invalid={!!errors.changes_required}
              {...register('changes_required')} />
          </FormField>
        </div>
      </FormSection>

      <FormSection step={3} title={screenshotRequired ? 'Screenshot of error' : 'Screenshot of error (optional)'}>
        <Controller
          control={control}
          name="screenshot"
          render={({ field }) => (
            <ScreenshotUploader
              value={(field.value as File | null) ?? null}
              onChange={field.onChange}
              error={errors.screenshot?.message as string | undefined}
              progress={progress}
              disabled={isSubmitting}
            />
          )}
        />
      </FormSection>

      <FormSection step={4} title="Priority">
        <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
          <select id="priority" className="field-input sm:max-w-xs" {...register('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FormField>
        <p className="mt-3 text-xs text-subtle">
          Reported by <strong>{profile?.name}</strong> ({profile?.email}). The date and feedback ID are assigned automatically.
        </p>
      </FormSection>

      <FormSection step={5} title="Submit">
        {submitError && (
          <p role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{submitError}</p>
        )}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          Submit Feedback
        </button>
      </FormSection>
    </form>
  )
}
