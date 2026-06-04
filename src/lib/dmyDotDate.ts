/** Display / mask format for date filter fields (DD.MM.YYYY). */
export const DMY_DOT_MASK_PLACEHOLDER = 'DD.MM.YYYY'

const DMY_DOT_COMPLETE = /^\d{2}\.\d{2}\.\d{4}$/

/**
 * Format a calendar date as DD.MM.YYYY using local date parts.
 */
export function formatDateAsDmyDot(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/**
 * Apply DD.MM.YYYY mask from raw digits only (max 8 digits). Dots are inserted automatically.
 */
export function maskDmyDotFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

export function isCompleteDmyDot(text: string): boolean {
  return DMY_DOT_COMPLETE.test(text)
}

/**
 * Parse DD.MM.YYYY to a local-midnight Date, or null if invalid calendar date.
 */
export function parseDmyDotToDate(text: string): Date | null {
  if (!isCompleteDmyDot(text)) return null
  const [dayStr, monthStr, yearStr] = text.split('.')
  const day = Number(dayStr)
  const month = Number(monthStr)
  const year = Number(yearStr)
  if (month < 1 || month > 12 || day < 1 || year < 1000 || year > 9999) return null

  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export type DmyDotValidationResult =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'invalid' }
  | { status: 'outOfRange' }
  | { status: 'valid'; date: Date }

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime()
}

/**
 * Validate masked input for date filters. Incomplete input is not valid.
 */
export function validateDmyDotInput(
  text: string,
  min?: Date | null,
  max?: Date | null
): DmyDotValidationResult {
  const trimmed = text.trim()
  if (!trimmed) return { status: 'empty' }
  if (!isCompleteDmyDot(trimmed)) return { status: 'incomplete' }

  const date = parseDmyDotToDate(trimmed)
  if (!date) return { status: 'invalid' }

  const t = startOfLocalDay(date)
  if (min != null && t < startOfLocalDay(min)) return { status: 'outOfRange' }
  if (max != null && t > startOfLocalDay(max)) return { status: 'outOfRange' }

  return { status: 'valid', date }
}
