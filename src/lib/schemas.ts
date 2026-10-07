import { z } from 'zod'
import type { DashboardOption } from '@/types'
import { levelLabel, nextLevelOptions } from '@/utils/tree'
import {
  ACCEPTED_IMAGE_TYPES, BUSINESSES, COMPONENT_CATEGORIES, FEEDBACK_TYPES, MAX_SCREENSHOT_BYTES, PRIORITIES,
} from './constants'

export function validateScreenshot(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Use PNG, JPG, JPEG or WEBP.'
  }
  if (file.size > MAX_SCREENSHOT_BYTES) return 'File is too large. Maximum size is 10 MB.'
  if (file.size === 0) return 'The selected file is empty.'
  return null
}

export function buildFeedbackSchema(screenshotRequired: boolean, options: DashboardOption[] = []) {
  return z.object({
    business: z.enum(BUSINESSES, { errorMap: () => ({ message: 'Select a business.' }) }),
    dashboard_ids: z.array(z.string()),
    component_category: z.enum(COMPONENT_CATEGORIES, { errorMap: () => ({ message: 'Select a component type.' }) }),
    card_graph_name: z.string().trim().min(2, 'Enter the component name.').max(200, 'Keep it under 200 characters.'),
    feedback_type: z.enum(FEEDBACK_TYPES, { errorMap: () => ({ message: 'Select a feedback type.' }) }),
    changes_required: z.string().trim().min(10, 'Please describe the issue (at least 10 characters).').max(5000, 'Keep it under 5000 characters.'),
    owner: z.string().optional(),
    priority: z.enum(PRIORITIES),
    screenshot: z.custom<File | null>().superRefine((file, ctx) => {
      if (!file) {
        if (screenshotRequired) ctx.addIssue({ code: 'custom', message: 'A screenshot of the error is required.' })
        return
      }
      const err = validateScreenshot(file as File)
      if (err) ctx.addIssue({ code: 'custom', message: err })
    }),
  }).superRefine((v, ctx) => {
    // Keep drilling until a leaf of the admin-configured Business > Dashboard tree is chosen.
    if (nextLevelOptions(options, v.business, v.dashboard_ids).length > 0) {
      ctx.addIssue({ code: 'custom', path: ['dashboard_ids'], message: `Select a ${levelLabel(v.dashboard_ids.length).toLowerCase()}.` })
    }
  })
}

export type FeedbackFormValues = z.infer<ReturnType<typeof buildFeedbackSchema>>

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})
export type LoginValues = z.infer<typeof loginSchema>
