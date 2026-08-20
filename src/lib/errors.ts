/**
 * Error Handling Utilities
 *
 * Centralized error handling functions for consistent error management.
 */

import axios from 'axios'
import type { AxiosError } from 'axios'

const CSV_SKIP_REASON_LABELS: Record<string, string> = {
  missing_client_id: 'missing client_id',
  invalid_client_id: 'invalid client_id (use CRM client ID, not tax ID or phone)',
  client_not_found: 'client_id not found in project',
  missing_phone: 'missing phone',
  invalid_phone: 'invalid phone',
  missing_email: 'missing email',
  invalid_email: 'invalid email',
  duplicate_destination: 'duplicate destination',
}

function formatMessagingErrorDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null
  const record = details as Record<string, unknown>
  const skipped = record.skipped_by_reason
  if (!skipped || typeof skipped !== 'object') return null
  const parts = Object.entries(skipped as Record<string, number>)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([reason, count]) => {
      const label = CSV_SKIP_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
      return `${count}× ${label}`
    })
  return parts.length > 0 ? `(${parts.join('; ')})` : null
}

/**
 * Get a user-friendly error message from an error object
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Handle Axios errors
    // FastAPI can return detail as string, array of strings, or array of validation objects
    const axiosError = error as AxiosError<{
      detail?:
        | string
        | string[]
        | Array<{ type?: string; loc?: unknown[]; msg?: string; input?: unknown; ctx?: unknown }>
      message?: string
    }>

    if (axiosError.response?.data) {
      // Try to get error message from response
      const data = axiosError.response.data as Record<string, unknown>
      if (typeof data === 'string') return data

      // Messaging microservice envelope: { error: { code, message, details } }
      const nestedError = data.error
      if (
        nestedError &&
        typeof nestedError === 'object' &&
        nestedError !== null &&
        'message' in nestedError &&
        typeof (nestedError as { message?: unknown }).message === 'string'
      ) {
        const message = (nestedError as { message: string }).message
        const details = (nestedError as { details?: unknown }).details
        const detailSuffix = formatMessagingErrorDetails(details)
        // Backend CSV errors often embed skip reasons in message; avoid duplicating.
        if (detailSuffix && !message.includes('row(s):')) {
          return `${message} ${detailSuffix}`
        }
        return message
      }

      // Handle detail field - can be string, array of strings, or array of validation objects
      if (data.detail) {
        if (typeof data.detail === 'string') {
          return data.detail
        }
        if (Array.isArray(data.detail)) {
          // FastAPI validation errors: array of objects with {type, loc, msg, input, ctx}
          const messages = data.detail
            .map((item) => {
              if (typeof item === 'string') {
                return item
              }
              if (
                typeof item === 'object' &&
                item !== null &&
                'msg' in item &&
                typeof item.msg === 'string'
              ) {
                return item.msg
              }
              // Fallback: try to stringify if it's an object
              return typeof item === 'object' ? JSON.stringify(item) : String(item)
            })
            .filter((msg) => msg && msg.length > 0)

          return messages.length > 0 ? messages.join('. ') : 'Validation error occurred'
        }
      }

      if (typeof data.message === 'string' && data.message) return data.message
    }

    // Network errors
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.'
    }
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.'
    }

    // HTTP status errors
    if (axiosError.response?.status === 401) {
      return 'Unauthorized. Please log in again.'
    }
    if (axiosError.response?.status === 403) {
      return 'Access denied. You do not have permission to perform this action.'
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found.'
    }
    if (axiosError.response?.status === 422) {
      return 'Validation error. Please check your input and try again.'
    }
    if (axiosError.response?.status === 500) {
      return 'Server error. Please try again later.'
    }

    return axiosError.message || 'An error occurred while processing your request.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}

/**
 * Type guard to check if error is an Axios error
 */
export function isApiError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error)
}

/**
 * True when the failed response actually carries a message of the backend's own.
 *
 * `getErrorMessage` has no such thing as "nothing to say": with an empty or
 * body-less response it degrades to axios' own `error.message` — the
 * untranslated "Request failed with status code 400" — which is exactly what a
 * proxy that strips the body produces, and not a sentence to show an operator.
 * So a caller passes a server detail through only when there IS one and takes
 * its own localized text otherwise.
 *
 * The shapes checked are the ones `getErrorMessage` reads out of the BODY for a
 * FastAPI endpoint: a bare string body, `detail` (string or the validation
 * array), and `message`. An empty string or an empty array is no detail either:
 * the empty string falls through to `message` and then to the axios text, while
 * an empty array makes `getErrorMessage` return its hardcoded English
 * "Validation error occurred" — both equally unfit to show, so the helper
 * treats both as "no detail".
 *
 * A NON-empty array is taken at its word: this is a "has something to say"
 * predicate, not a validator of what `getErrorMessage` will make of the items
 * (a `detail: [{}]` therefore still counts — see TASK-010).
 */
export function hasResponseDetail(error: unknown): boolean {
  if (!isApiError(error)) return false
  const data = error.response?.data
  if (typeof data === 'string') return data.trim() !== ''
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') return detail.trim() !== ''
  if (Array.isArray(detail)) return detail.length > 0
  return typeof record.message === 'string' && record.message.trim() !== ''
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatus(error: unknown): number | null {
  if (isApiError(error) && error.response) {
    return error.response.status
  }
  return null
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED'
  }
  return false
}
