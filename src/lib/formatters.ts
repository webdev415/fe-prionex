import i18n from './i18n'

/**
 * Formatting utilities for display
 */

/**
 * Format period display (start - end dates)
 */
export function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '—'

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
  }

  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }
  return startDate ? `From ${formatDate(startDate)}` : `Until ${formatDate(endDate!)}`
}

/**
 * Format currency value with ₴ symbol
 * Uses locale-aware formatting and replaces commas with spaces (for Ukrainian/Russian locales)
 * Example: "₴ 10 080" or "₴ 1,234" (depending on locale)
 */
export function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '—'

  // Get current language from i18n, default to 'uk'
  const currentLanguage = i18n.language || 'uk'
  const locale = currentLanguage === 'uk' ? 'uk-UA' : currentLanguage === 'ru' ? 'ru-RU' : 'en-US'

  // Format with locale-aware number formatting
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/,/g, ' ') // Replace commas with spaces (for Ukrainian/Russian locales)

  return `₴ ${formatted}`
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '—'
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format date for display (MM/DD/YYYY)
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Format datetime for display
 */
export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
