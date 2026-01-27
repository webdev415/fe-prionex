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
