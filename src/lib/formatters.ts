import i18n, { intlLocaleForUiLanguage } from './i18n'
import { isRealCalendarDate } from './calendarDate'
import { activeCurrency, currencySymbol, knownCurrency, type Currency } from './projectCurrency'

/**
 * Formatting utilities for display
 */

function isSpanishUi(): boolean {
  return (i18n.language ?? '').split('-')[0].toLowerCase() === 'es'
}

export function dateSeparator(): string {
  return isSpanishUi() ? '/' : '-'
}

export function uiLocale(): string | undefined {
  return isSpanishUi() ? 'es-ES' : undefined
}

export function uiDecimal(text: string): string {
  return isSpanishUi() ? text.replace('.', ',') : text
}

function amountOrZero(amount: string | number | null | undefined): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0)
  return Number.isNaN(num) ? 0 : num
}

type ForeignCurrency = Exclude<Currency, 'UAH'>

/** The euro or the Canadian dollar; null leaves the amount to the hryvnia formats. */
function foreignCurrency(currency: string | null | undefined): ForeignCurrency | null {
  const known = knownCurrency(currency)
  return known === 'UAH' ? null : known
}

// Intl lays the number out for the UI language, but the sign comes from `currencySymbol`:
// ICU writes the Canadian dollar as `CAD` in uk/es and as a bare `$` with `narrowSymbol`.
function formatForeign(
  num: number,
  fractionDigits: number,
  currency: ForeignCurrency,
  useGrouping = true
): string {
  return new Intl.NumberFormat(intlLocaleForUiLanguage(i18n.language), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping,
  })
    .formatToParts(num)
    .map((part) => (part.type === 'currency' ? currencySymbol(currency) : part.value))
    .join('')
}

export function withCurrency(
  amountText: string,
  uahStyle: 'prefix' | 'suffix' | 'tight' = 'prefix',
  currency: string | null | undefined = activeCurrency()
): string {
  const foreign = foreignCurrency(currency)
  if (foreign) {
    const symbol = currencySymbol(foreign)
    if (intlLocaleForUiLanguage(i18n.language) !== 'en-US') return `${amountText} ${symbol}`
    const sign = amountText.startsWith('-') ? '-' : ''
    return `${sign}${symbol}${amountText.slice(sign.length).trim()}`
  }
  if (uahStyle === 'suffix') return `${amountText} ₴`
  if (uahStyle === 'tight') return `₴${amountText}`
  return `₴ ${amountText}`
}

/**
 * Helper: format a Date object to DD-MM-YYYY
 */
function toDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const sep = dateSeparator()
  return `${day}${sep}${month}${sep}${year}`
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
  return startDate
    ? `${i18n.t('components.period.from', { defaultValue: 'From' })} ${fmt(startDate)}`
    : `${i18n.t('components.period.until', { defaultValue: 'Until' })} ${fmt(endDate!)}`
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
 * Uses locale-aware formatting and replaces commas with spaces for Ukrainian locale
 * Accepts both string and number inputs (backend sends financial fields as strings).
 * Example: "₴ 10 080" or "₴ 1,234" (depending on locale)
 */
export function formatCurrency(amount?: string | number | null, currency?: string | null): string {
  if (amount === undefined || amount === null) return '—'

  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '—'

  const foreign = foreignCurrency(currency ?? activeCurrency())
  if (foreign) return formatForeign(num, 0, foreign)

  const locale = intlLocaleForUiLanguage(i18n.language)

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
  const foreign = foreignCurrency(activeCurrency())
  if (foreign) return formatForeign(amountOrZero(amount), 2, foreign, false)
  if (amount === undefined || amount === null || amount === '') return '₴0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
  if (Number.isNaN(num)) return '₴0.00'
  const negative = num < 0
  const abs = Math.abs(num)
  const cents = Math.round(abs * 100 + Number.EPSILON)
  const intPart = Math.floor(cents / 100)
  const frac = cents % 100
  const body = `${intPart}${isSpanishUi() ? ',' : '.'}${String(frac).padStart(2, '0')}`
  return negative ? `₴-${body}` : `₴${body}`
}

/**
 * UAH display for client profile / debt flows: `₴ ` prefix, space as thousands separator,
 * period as decimal separator, always exactly two fraction digits (rounded via integer cents).
 * Examples: 50 → "₴ 50.00", 50.5 → "₴ 50.50", 50.559 → "₴ 50.56"
 */
export function formatMoneyUAHTwoDecimals(amount: string | number | null | undefined): string {
  const foreign = foreignCurrency(activeCurrency())
  if (foreign) return formatForeign(amountOrZero(amount), 2, foreign)
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
  const spanish = isSpanishUi()
  const grouped = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, spanish ? '.' : ' ')
  const fracStr = String(frac).padStart(2, '0')
  const body = `${grouped}${spanish ? ',' : '.'}${fracStr}`
  return negative ? `₴ -${body}` : `₴ ${body}`
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '—'
  return new Intl.NumberFormat(isSpanishUi() ? 'es-ES' : 'en-US').format(num)
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
  const sep = dateSeparator()
  return `${day}${sep}${month}${sep}${year}`
}

/** A bare calendar date — no time, no zone: "2026-10-02". */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Format date for display → DD-MM-YYYY
 *
 * A bare `YYYY-MM-DD` is a calendar date, not an instant, so it is split as a
 * string. `new Date('2026-10-02')` parses as UTC midnight, and reading that
 * back through the local getters yields 01-10 for every viewer west of UTC:
 * the loan card rendered a payment due 10-10 as 09-10 in America/*. Kyiv
 * (UTC+2/+3) rounds the other way and never saw it, which is how this lasted.
 *
 * The string path is taken only for a day that REALLY EXISTS, not for anything
 * merely shaped like one, and a shape match that fails the existence check is
 * answered with '—' rather than handed to `new Date`. `formatIsoDate` matches
 * on shape alone, so routing every `\d{4}-\d{2}-\d{2}` there would render the
 * backend's zero-date `0000-00-00` as `00-00-0000`; and `new Date` is no
 * fallback either, because it rejects `0000-00-00` and `2026-13-45` but
 * silently ROLLS OVER `2026-02-31` into 02-03-2026. Neither is a date the
 * operator can act on, so both read '—'.
 *
 * Strings that carry a time keep the Date path — there the instant is the
 * point, and the caller wants it in the viewer's own zone.
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  if (ISO_DATE_ONLY.test(dateStr)) return isRealCalendarDate(dateStr) ? formatIsoDate(dateStr) : '—'
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
 *
 * If `timezone` is given, the value is formatted in that IANA tz instead of
 * browser-local. Naive strings without Z/offset are interpreted as UTC
 * (matches the DB convention).
 */
export function formatDateTime(dateStr?: string, timezone?: string | null): string {
  if (!dateStr) return '—'
  let normalized = dateStr.replace(' ', 'T')
  if (!normalized.endsWith('Z') && !/[-+]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z'
  }
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return '—'
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d)
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
      const sep = dateSeparator()
      return `${get('day')}${sep}${get('month')}${sep}${get('year')} ${get('hour')}:${get('minute')}`
    } catch {
      // fall through to browser-local
    }
  }
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
 * Convention (post-KAN-451): the task DB stores `due_date` as UTC naive
 * datetime, and the API returns `isoformat()` without `Z`. Naive strings
 * are therefore treated as UTC and rendered in the user's profile
 * timezone (falls back to Europe/Kyiv if not provided). Strings with an
 * explicit Z or numeric offset are absolute instants, shown in the same
 * target timezone.
 */
export function formatTaskDueDateForDisplay(
  isoDate: string | null | undefined,
  timezone?: string | null
): string {
  if (isoDate == null || String(isoDate).trim() === '') return '—'
  const s = String(isoDate).trim()

  // Treat naive strings as UTC by appending Z; offset-aware strings pass through.
  const absolute = hasExplicitTimeZoneOffset(s) ? s : `${s.replace(' ', 'T')}Z`
  const d = new Date(absolute)
  if (isNaN(d.getTime())) return '—'

  const targetTz = timezone || TASK_SERVICE_WALL_TIMEZONE
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: targetTz,
    }).formatToParts(d)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    const sep = dateSeparator()
    return `${get('day')}${sep}${get('month')}${sep}${get('year')} ${get('hour')}:${get('minute')}`
  } catch {
    return '—'
  }
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

    const spanish = isSpanishUi()
    const formatter = new Intl.DateTimeFormat(spanish ? 'es-ES' : 'en-US', options)
    const parts = formatter.formatToParts(date)

    const month = parts.find((p) => p.type === 'month')?.value || ''
    const day = parts.find((p) => p.type === 'day')?.value || ''
    const hour = parts.find((p) => p.type === 'hour')?.value || ''
    const minute = parts.find((p) => p.type === 'minute')?.value || ''
    const second = parts.find((p) => p.type === 'second')?.value || ''

    const monthDay = spanish ? `${day} ${month}` : `${month} ${day}`
    return `${monthDay}\n${hour}:${minute}:${second}`
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
    const sep = dateSeparator()
    return `${get('day')}${sep}${get('month')}${sep}${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
  } catch {
    return '—'
  }
}

/**
 * Compose a client's display name in Ukrainian convention: Last First Middle.
 * Middle name is skipped if empty/null — no trailing space or extra separator.
 */
export function formatClientFullName(client: {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
}): string {
  return [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(' ')
}
