export const COMPONENT_CATEGORIES = [
  'KPI Card', 'Chart', 'Graph', 'Table', 'Filter', 'Slicer', 'Dashboard Header', 'Navigation', 'Tooltip', 'Other',
] as const

export const BUSINESSES = ['Remote', 'Field', 'Care', 'BPA'] as const

export const FEEDBACK_TYPES = [
  'Data Issue', 'Calculation Issue', 'UI Issue', 'Layout Issue', 'Label Issue',
  'Filter Issue', 'Performance Issue', 'Functional Issue', 'Enhancement', 'Other',
] as const

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const

export const STATUSES = ['New', 'Under Review', 'In Progress', 'Blocked', 'Completed', 'Rejected'] as const

/** Allowed workflow transitions (admin UI). Current status is always selectable. */
export const STATUS_TRANSITIONS: Record<(typeof STATUSES)[number], readonly (typeof STATUSES)[number][]> = {
  New: ['Under Review', 'In Progress', 'Rejected'],
  'Under Review': ['In Progress', 'Rejected', 'Completed'],
  'In Progress': ['Blocked', 'Completed', 'Under Review'],
  Blocked: ['In Progress', 'Rejected'],
  Completed: ['In Progress', 'Under Review'],
  Rejected: ['Under Review'],
}

export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const ACCEPTED_IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'] as const

export const SCREENSHOT_BUCKET = 'feedback-screenshots'
export const SIGNED_URL_TTL_SECONDS = 300
export const PAGE_SIZES = [10, 25, 50, 100] as const
