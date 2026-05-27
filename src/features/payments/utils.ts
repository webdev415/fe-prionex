/**
 * Payment Utility Functions
 * Convert between backend API format and frontend display format
 */

import type {
  PaymentMethod as BackendPaymentMethod,
  PaymentStatus as BackendPaymentStatus,
} from './api/types'

// Export receipt generator utilities
export * from './utils/receiptGenerator'
export * from './utils/verifiedPaymentsByContract'

// Frontend display formats
export type FrontendPaymentMethod = 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
export type FrontendPaymentStatus = 'Verified' | 'Pending' | 'Cancelled'

/**
 * Convert backend payment method to frontend display format
 */
export function backendToFrontendPaymentMethod(
  method: BackendPaymentMethod
): FrontendPaymentMethod {
  const mapping: Record<BackendPaymentMethod, FrontendPaymentMethod> = {
    bank_transfer: 'Bank Transfer',
    online_gateway: 'Online Gateway',
    cash: 'Cash',
    card: 'Card',
    other: 'Other',
  }
  return mapping[method] || 'Other'
}

/**
 * Convert frontend payment method to backend API format
 */
export function frontendToBackendPaymentMethod(
  method: FrontendPaymentMethod
): BackendPaymentMethod {
  const mapping: Record<FrontendPaymentMethod, BackendPaymentMethod> = {
    'Bank Transfer': 'bank_transfer',
    'Online Gateway': 'online_gateway',
    Cash: 'cash',
    Card: 'card',
    Other: 'other',
  }
  return mapping[method] || 'other'
}

/**
 * Convert backend payment status to frontend display format
 */
export function backendToFrontendPaymentStatus(
  status: BackendPaymentStatus
): FrontendPaymentStatus {
  const mapping: Record<BackendPaymentStatus, FrontendPaymentStatus> = {
    verified: 'Verified',
    pending: 'Pending',
    cancelled: 'Cancelled',
  }
  return mapping[status] || 'Pending'
}

/**
 * Convert frontend payment status to backend API format
 */
export function frontendToBackendPaymentStatus(
  status: FrontendPaymentStatus
): BackendPaymentStatus {
  const mapping: Record<FrontendPaymentStatus, BackendPaymentStatus> = {
    Verified: 'verified',
    Pending: 'pending',
    Cancelled: 'cancelled',
  }
  return mapping[status] || 'pending'
}

/**
 * Format date from ISO string to MM/DD/YYYY
 */
export function formatPaymentDate(dateString: string): string {
  if (!dateString) return ''

  // Extract date part from datetime strings (e.g., "2026-01-24T00:00:00Z" -> "2026-01-24")
  // Handle both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DDTHH:mm:ss...) formats
  const datePartMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString)
  if (!datePartMatch) {
    // If no match, try to parse as-is
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return dateString
    }
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }

  // Handle plain YYYY-MM-DD (date-only) strings as LOCAL dates to avoid
  // timezone shifts that can move the day back (e.g. 2026-01-24 -> 01/23/2026).
  const [, yearStr, monthStr, dayStr] = datePartMatch
  const year = Number(yearStr)
  const month = Number(monthStr) - 1 // JS months 0-11
  const day = Number(dayStr)
  const date = new Date(year, month, day)

  if (isNaN(date.getTime())) {
    return dateString
  }

  const formattedMonth = String(date.getMonth() + 1).padStart(2, '0')
  const formattedDay = String(date.getDate()).padStart(2, '0')
  const formattedYear = date.getFullYear()
  return `${formattedMonth}/${formattedDay}/${formattedYear}`
}

/**
 * Check if payment date is less than 7 days old
 */
export function isPaymentLessThan7DaysOld(dateString: string): boolean {
  try {
    // Backend sends datetime in UTC but without "Z" suffix
    // Append "Z" if it's a datetime string to ensure UTC parsing
    let dateStr = dateString
    if (
      (dateStr.includes('T') || dateStr.includes(' ')) &&
      !dateStr.endsWith('Z') &&
      !dateStr.includes('+')
    ) {
      dateStr = dateStr.replace(' ', 'T') + 'Z'
    }

    const paymentDate = new Date(dateStr)
    if (isNaN(paymentDate.getTime())) {
      return false
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    paymentDate.setHours(0, 0, 0, 0)

    const diffTime = today.getTime() - paymentDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays < 7 && diffDays >= 0
  } catch (error) {
    console.error('Error parsing payment date:', dateString, error)
    return false
  }
}
