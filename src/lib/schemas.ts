import { z } from 'zod'
import {
  ACCEPTED_IMAGE_TYPES, COMPONENT_CATEGORIES, FEEDBACK_TYPES, MAX_SCREENSHOT_BYTES, PRIORITIES,
} from './constants'

export function validateScreenshot(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Use PNG, JPG, JPEG or WEBP.'
  }
  if (file.size > MAX_SCREENSHOT_BYTES) return 'File is too large. Maximum size is 10 MB.'
  if (file.size === 0) return 'The selected file is empty.'
  return null
}

export function buildFeedbackSchema(screenshotRequired: boolean) {
  return z.object({
    component_category: z.enum(COMPONENT_CATEGORIES, { errorMap: () => ({ message: 'Select a component type.' }) }),
    card_graph_name: z.string().trim().min(2, 'Enter the component name.').max(200, 'Keep it under 200 characters.'),
    feedback_type: z.enum(FEEDBACK_TYPES, { errorMap: () => ({ message: 'Select a feedback type.' }) }),
    changes_required: z.string().trim().min(10, 'Please describe the issue (at least 10 characters).').max(5000, 'Keep it under 5000 characters.'),
    priority: z.enum(PRIORITIES),
    screenshot: z.custom<File | null>().superRefine((file, ctx) => {
      if (!file) {
        if (screenshotRequired) ctx.addIssue({ code: 'custom', message: 'A screenshot of the error is required.' })
        return
      }
      const err = validateScreenshot(file as File)
      if (err) ctx.addIssue({ code: 'custom', message: err })
    }),
  })
}

export type FeedbackFormValues = z.infer<ReturnType<typeof buildFeedbackSchema>>

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})
export type LoginValues = z.infer<typeof loginSchema>
