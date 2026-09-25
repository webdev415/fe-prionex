/**
 * Error Handling Utilities
 *
 * Centralized error handling functions for consistent error management.
 */

import axios from 'axios'
import type { AxiosError } from 'axios'
import i18n from 'i18next'

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

function httpMessage(key: string, defaultValue: string): string {
  return i18n.t(`http.${key}`, { ns: 'errors', defaultValue })
}

export function translateErrorCode(code: unknown, fallback: string, params?: unknown): string {
  if (typeof code !== 'string' || !code) return fallback
  const values = params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
  const translated: unknown = i18n.t(`codes.${code}`, {
    ns: 'errors',
    defaultValue: '',
    replace: values,
  })
  return typeof translated === 'string' && translated && !translated.includes('{{')
    ? translated
    : fallback
}

export function localizeCodedDetail(error: unknown): void {
  if (!axios.isAxiosError(error)) return
  const data = error.response?.data
  if (!data || typeof data !== 'object') return
  const record = data as Record<string, unknown>
  const { detail, code, params } = record
  if (typeof detail !== 'string' || typeof code !== 'string') return
  Object.defineProperty(record, 'detail', {
    get: () => translateErrorCode(code, detail, params),
    set: (value: unknown) => {
      Object.defineProperty(record, 'detail', {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    },
    enumerable: true,
    configurable: true,
  })
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
        const message = translateErrorCode(
          (nestedError as { code?: unknown }).code,
          (nestedError as { message: string }).message
        )
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
          return translateErrorCode(data.code, data.detail, data.params)
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
              // Anything else is NOT a sentence, so it is dropped rather than
              // stringified: `JSON.stringify({})` is "{}", and a number or a
              // null would arrive as "42" / "null" — text that reads as
              // gibberish next to the real messages it would be joined with.
              // This keeps the reader in step with `hasResponseDetail`, which
              // counts exactly these two shapes as usable: an array of nothing
              // but unreadable items now means "no detail" to both, so a caller
              // that gates on the predicate can never be handed "{}".
              return null
            })
            .filter((msg): msg is string => msg !== null && msg.trim().length > 0)

          return messages.length > 0
            ? messages.join('. ')
            : httpMessage('validationOccurred', 'Validation error occurred')
        }
      }

      if (typeof data.message === 'string' && data.message) return data.message
    }

    // Network errors
    if (axiosError.code === 'ECONNABORTED') {
      return httpMessage('timeout', 'Request timeout. Please try again.')
    }
    if (axiosError.code === 'ERR_NETWORK') {
      return httpMessage('network', 'Network error. Please check your connection.')
    }

    // HTTP status errors
    if (axiosError.response?.status === 401) {
      return httpMessage('unauthorized', 'Unauthorized. Please log in again.')
    }
    if (axiosError.response?.status === 403) {
      return httpMessage(
        'forbidden',
        'Access denied. You do not have permission to perform this action.'
      )
    }
    if (axiosError.response?.status === 404) {
      return httpMessage('notFound', 'Resource not found.')
    }
    if (axiosError.response?.status === 422) {
      return httpMessage('validation', 'Validation error. Please check your input and try again.')
    }
    if (axiosError.response?.status === 500) {
      return httpMessage('server', 'Server error. Please try again later.')
    }

    return (
      axiosError.message ||
      httpMessage('generic', 'An error occurred while processing your request.')
    )
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return httpMessage('unexpected', 'An unexpected error occurred')
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
 * array), and `message`. A blank `detail` string and an empty array are no
 * detail either — an empty array makes `getErrorMessage` return its hardcoded
 * English "Validation error occurred", which is as unfit to show as the axios
 * text this predicate exists to suppress.
 *
 * A NON-empty array counts only when at least one item is actually USABLE — a
 * non-blank string, or a validation object with a non-blank string `msg` (the
 * two shapes `getErrorMessage` reads; anything else it drops).
 *
 * KNOWN ASYMMETRY, deliberately left alone: this predicate stops at `detail`
 * once the key is present, while `getErrorMessage` falls THROUGH a falsy
 * `detail` to `message`. So `{ detail: '', message: 'Sell window too wide' }`
 * reads as "no detail" here even though `getErrorMessage` would return that
 * perfectly good sentence, and a caller gated on this predicate shows its own
 * localized text instead. The cost is one needlessly generic message on a body
 * no backend of ours actually sends (FastAPI writes `detail`, our services
 * write `detail`; `message` is the messaging microservice's envelope, which
 * carries no `detail` at all). Widening the check to keep looking past a blank
 * `detail` would trade that for a second definition of "has a detail" to keep
 * in step with `getErrorMessage`'s order of reads — the very drift this
 * predicate exists to prevent.
 *
 * SECOND ASYMMETRY OF THE SAME KIND: this predicate reads only the TOP-LEVEL
 * shapes, while `getErrorMessage` also understands the messaging
 * microservice's nested envelope `{ error: { message, details } }` — so a 400
 * in that form reads as "no detail" here and reaches the operator as the tab's
 * generic localized title rather than as the server's sentence. No endpoint
 * behind the report tabs answers in that shape today (FastAPI and our services
 * write `detail`), which is why it is recorded rather than fixed.
 */
export function hasResponseDetail(error: unknown): boolean {
  if (!isApiError(error)) return false
  const data = error.response?.data
  if (typeof data === 'string') return data.trim() !== ''
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') return detail.trim() !== ''
  if (Array.isArray(detail)) {
    return detail.some((item: unknown) =>
      typeof item === 'string'
        ? item.trim() !== ''
        : typeof (item as { msg?: unknown } | null)?.msg === 'string' &&
          (item as { msg: string }).msg.trim() !== ''
    )
  }
  return typeof record.message === 'string' && record.message.trim() !== ''
}

/**
 * The machine-readable refusal code of a backend answer (`{ detail, code }`),
 * or null when the answer carries none. A screen that reacts to ONE refusal
 * (say, PROJECT_SCOPE_DENIED) asks by code, never by the translated sentence.
 */
export function getErrorCode(error: unknown): string | null {
  if (!isApiError(error)) return null
  const data = error.response?.data
  if (!data || typeof data !== 'object') return null
  const code = (data as Record<string, unknown>).code
  return typeof code === 'string' && code !== '' ? code : null
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
