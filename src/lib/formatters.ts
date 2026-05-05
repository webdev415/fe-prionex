import i18n from './i18n'

/**
 * Formatting utilities for display
 */

/**
 * Helper: format a Date object to DD-MM-YYYY
 */
function toDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/** DD.MM.YYYY (e.g. SMS template {due_date}) */
function toDMYDot(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Format period display (start - end dates)
 */
export function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '—'

  const fmt = (dateStr: string) => toDMY(new Date(dateStr))

  if (startDate && endDate) {
    return `${fmt(startDate)} - ${fmt(endDate)}`
  }
  return startDate ? `From ${fmt(startDate)}` : `Until ${fmt(endDate!)}`
}

/**
 * Parse a financial amount from string or number to a numeric value.
 * Backend sends Decimal fields as strings for precision; this safely converts them.
 */
export function parseAmount(value: string | number | null | undefined): number {
  if (value == null) return 0
  const num = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(num) ? 0 : num
}

/**
 * Format currency value with ₴ symbol
 * Uses locale-aware formatting and replaces commas with spaces (for Ukrainian/Russian locales)
 * Accepts both string and number inputs (backend sends financial fields as strings).
 * Example: "₴ 10 080" or "₴ 1,234" (depending on locale)
 */
export function formatCurrency(amount?: string | number | null): string {
  if (amount === undefined || amount === null) return '—'

  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '—'

  // Get current language from i18n, default to 'uk'
  const currentLanguage = i18n.language || 'uk'
  const locale = currentLanguage === 'uk' ? 'uk-UA' : currentLanguage === 'ru' ? 'ru-RU' : 'en-US'

  // Format with locale-aware number formatting
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(num)
    .replace(/,/g, ' ') // Replace commas with spaces (for Ukrainian/Russian locales)

  return `₴ ${formatted}`
}

/**
 * Tight UAH display: `₴` directly attached to digits, no thousands separator, two
 * fraction digits. Used in dense rows / chain-executor labels where the client
 * spec is `₴5000.00` exactly.
 */
export function formatMoneyKopeckTight(amount: string | number | null | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '₴0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (Number.isNaN(num)) return '₴0.00'
  const negative = num < 0
  const abs = Math.abs(num)
  const cents = Math.round(abs * 100 + Number.EPSILON)
  const intPart = Math.floor(cents / 100)
  const frac = cents % 100
  const body = `${intPart}.${String(frac).padStart(2, '0')}`
  return negative ? `₴-${body}` : `₴${body}`
}

/**
 * UAH display for client profile / debt flows: `₴ ` prefix, space as thousands separator,
 * period as decimal separator, always exactly two fraction digits (rounded via integer cents).
 * Examples: 50 → "₴ 50.00", 50.5 → "₴ 50.50", 50.559 → "₴ 50.56"
 */
export function formatMoneyUAHTwoDecimals(amount: string | number | null | undefined): string {
  if (amount === undefined || amount === null || amount === '') {
    return '₴ 0.00'
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (Number.isNaN(num)) {
    return '₴ 0.00'
  }
  const negative = num < 0
  const abs = Math.abs(num)
  const cents = Math.round(abs * 100 + Number.EPSILON)
  const intPart = Math.floor(cents / 100)
  const frac = cents % 100
  const grouped = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const fracStr = String(frac).padStart(2, '0')
  const body = `${grouped}.${fracStr}`
  return negative ? `₴ -${body}` : `₴ ${body}`
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '—'
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format a calendar-date ISO string (YYYY-MM-DD) for display → DD-MM-YYYY.
 * Timezone-safe: splits the string directly without instantiating Date(),
 * so the rendered calendar date is identical in every browser timezone.
 * Accepts YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS... (datetime is truncated to its
 * date portion). Returns '—' for null/empty/invalid input.
 */
export function formatIsoDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  // Accept "2026-04-16" and "2026-04-16T00:00:00Z" alike — take the date part only.
  const datePart = dateStr.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)
  if (!match) return '—'
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

/**
 * Format date for display → DD-MM-YYYY
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return toDMY(d)
}

/**
 * Format date for SMS variables → DD.MM.YYYY. Empty string if missing/invalid.
 */
export function formatDateDotDMY(dateStr?: string | null): string {
  if (dateStr == null || dateStr === '') return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return toDMYDot(d)
}

/**
 * Format datetime for display → DD-MM-YYYY HH:MM
 */
export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${toDMY(d)} ${hour}:${minute}`
}

/** IANA zone used by Task Service for naive DATETIME columns (see task model). */
const TASK_SERVICE_WALL_TIMEZONE = 'Europe/Kyiv'

/**
 * True if the string encodes an absolute instant (Z or numeric UTC offset at end).
 * Naive ISO strings from the task API (no suffix) must return false.
 */
function hasExplicitTimeZoneOffset(isoDate: string): boolean {
  const s = isoDate.trim()
  if (/[zZ]$/.test(s)) return true
  // RFC 3339 offset: ...+03:00, ...-05:00, or ...+0000 (after T, last occurrence)
  return /T[^Z]*[+-]\d{2}:\d{2}$/.test(s) || /T[^Z]*[+-]\d{4}$/.test(s)
}

/**
 * Format a Task Service `due_date` for the notification bell and similar UI.
 *
 * The task DB stores `due_date` as naive datetime in Europe/Kyiv wall time; the API
 * uses `isoformat()` (no `Z`). Interpreting that as UTC (e.g. by appending `Z`)
 * shifts the label by the Kyiv–UTC offset. For naive values we render the stored
 * calendar time in Europe/Kyiv. If the string includes `Z` or a numeric offset,
 * it is treated as an absolute instant and shown in Europe/Kyiv.
 */
export function formatTaskDueDateForDisplay(isoDate: string | null | undefined): string {
  if (isoDate == null || String(isoDate).trim() === '') return '—'
  const s = String(isoDate).trim()

  if (hasExplicitTimeZoneOffset(s)) {
    try {
      const d = new Date(s)
      if (isNaN(d.getTime())) return '—'
      const parts = new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: TASK_SERVICE_WALL_TIMEZONE,
      }).formatToParts(d)
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
      return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`
    } catch {
      return '—'
    }
  }

  const normalized = s.replace(' ', 'T')
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/.exec(normalized)
  if (!m) return '—'
  const [, year, month, day, hour, minute] = m
  return `${day}-${month}-${year} ${hour}:${minute}`
}
/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format timestamp for audit logs table display (short format: "Jan 26\n08:07:38")
 * Uses the user's timezone preference if provided, otherwise falls back to browser timezone
 */
export function formatAuditLogTimestamp(timestamp: string, timezone?: string): string {
  if (!timestamp) return '—'

  try {
    const date = new Date(timestamp)

    // Use Intl.DateTimeFormat with timezone if provided
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }

    if (timezone) {
      options.timeZone = timezone
    }

    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(date)

    const month = parts.find((p) => p.type === 'month')?.value || ''
    const day = parts.find((p) => p.type === 'day')?.value || ''
    const hour = parts.find((p) => p.type === 'hour')?.value || ''
    const minute = parts.find((p) => p.type === 'minute')?.value || ''
    const second = parts.find((p) => p.type === 'second')?.value || ''

    return `${month} ${day}\n${hour}:${minute}:${second}`
  } catch {
    // Fallback to original format if timezone conversion fails
    const date = new Date(timestamp)
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${month} ${day}\n${hours}:${minutes}:${seconds}`
  }
}

/**
 * Format timestamp for audit log detail modal (full format: "YYYY-MM-DD HH:MM:SS TZ")
 * Uses the user's timezone preference if provided, otherwise falls back to UTC
 */
export function formatAuditLogDetailTimestamp(timestamp: string, timezone?: string): string {
  if (!timestamp) return '—'

  try {
    const date = new Date(timestamp)

    // Use Intl.DateTimeFormat with timezone if provided
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }

    if (timezone) {
      options.timeZone = timezone
    } else {
      // Default to UTC if no timezone provided
      options.timeZone = 'UTC'
    }

    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(date)

    const year = parts.find((p) => p.type === 'year')?.value || ''
    const month = parts.find((p) => p.type === 'month')?.value || ''
    const day = parts.find((p) => p.type === 'day')?.value || ''
    const hour = parts.find((p) => p.type === 'hour')?.value || ''
    const minute = parts.find((p) => p.type === 'minute')?.value || ''
    const second = parts.find((p) => p.type === 'second')?.value || ''

    // Get timezone abbreviation or name
    let tzLabel = timezone || 'UTC'
    try {
      if (timezone) {
        // Try to get timezone abbreviation
        const tzFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          timeZoneName: 'short',
        })
        const tzParts = tzFormatter.formatToParts(date)
        const tzName = tzParts.find((p) => p.type === 'timeZoneName')?.value
        if (tzName) {
          tzLabel = tzName
        }
      }
    } catch {
      // If timezone name lookup fails, use the timezone string itself
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')} ${tzLabel}`
  } catch {
    // Fallback to UTC format if timezone conversion fails
    const date = new Date(timestamp)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
  }
}

/**
 * Convert UTC datetime to user's timezone
 * Returns formatted string: "DD-MM-YYYY HH:MM:SS"
 * If no timezone provided, defaults to UTC to ensure consistent behavior
 */
export function convertUTCToUserTimezone(utcDateTimeStr: string, timezone?: string): string {
  if (!utcDateTimeStr) return '—'

  try {
    // IMPORTANT: Backend sends datetime in UTC but without "Z" suffix
    // JavaScript's Date constructor treats strings without "Z" as LOCAL time
    // So we need to append "Z" to force it to be interpreted as UTC
    let dateStr = utcDateTimeStr
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T00:00:00')) {
      if (dateStr.includes('T') || dateStr.includes(' ')) {
        dateStr = dateStr.replace(' ', 'T') + 'Z'
      }
    }

    const date = new Date(dateStr)

    // Use Intl.DateTimeFormat only to extract numeric parts in the target timezone
    const tz = timezone || 'UTC'
    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: tz,
    }).formatToParts(date)

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
  } catch {
    return '—'
  }
}
