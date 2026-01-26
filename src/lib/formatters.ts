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
 * Format currency value
 */
export function formatCurrency(amount?: number, currency = 'UAH'): string {
  if (amount === undefined || amount === null) return '—'

  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
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
