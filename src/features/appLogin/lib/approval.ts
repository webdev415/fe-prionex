import axios from 'axios'

/**
 * Pure helpers of the sign-in confirmed on the bound phone (Epic 19 API-3):
 * the numbers the screen counts with and the reading of an API refusal.
 */

/** Poll cadence from the design, used when the API sends nothing usable. */
export const DEFAULT_POLL_INTERVAL_MS = 2000
/** The server answers `429 APP_LOGIN_POLL_TOO_FAST` to more than one poll a second. */
export const MIN_POLL_INTERVAL_MS = 1000
/** A misconfigured stand must not leave the person staring at a frozen screen. */
export const MAX_POLL_INTERVAL_MS = 10_000
/** Request lifetime from the design (`AUTH_APP_LOGIN_REQUEST_TTL_SECONDS=120`). */
export const DEFAULT_REQUEST_TTL_S = 120
/** Design §12.1: in the 2FA step «Надіслати ще раз» becomes active after 30 s. */
export const SECOND_FACTOR_RESEND_AFTER_S = 30

/** `poll_interval_ms` as the loop can use it: a finite number within the bounds above. */
export function pollIntervalMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_POLL_INTERVAL_MS
  }
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, value))
}

/** `expires_in` in seconds, or the design value when missing, zero or not a number. */
export function requestTtlSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_REQUEST_TTL_S
}

/**
 * The 2FA challenge offers the phone. `/login` lists `'app'` only when the
 * stand has the second-factor mode on and this person has an active bound
 * phone, so the list — not a build flag — decides.
 */
export function hasAppSecondFactor(methods: readonly string[] | null | undefined): boolean {
  return Array.isArray(methods) && methods.includes('app')
}

/** Whole minutes to show for a `retry_after`, never less than one. */
export function minutesToWait(retryAfterSeconds: number | null): number {
  if (retryAfterSeconds === null || retryAfterSeconds <= 0) return 1
  return Math.max(1, Math.ceil(retryAfterSeconds / 60))
}

/** What an API refusal says, read once so every branch agrees on it. */
export interface ApprovalRefusal {
  /** HTTP status; `null` when no response came back. */
  status: number | null
  /** `detail.code`, e.g. `APP_LOGIN_RATE_LIMITED`. */
  code: string | null
  message: string | null
  /** `detail.retry_after`, else the `Retry-After` header, in seconds. */
  retryAfterSeconds: number | null
  /** `detail.lockout_minutes` of `ACCOUNT_LOCKED`, as `/login` sends it. */
  lockoutMinutes: number | null
  /** The request never got an answer (timeout, DNS, connection refused). */
  network: boolean
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function approvalRefusalOf(error: unknown): ApprovalRefusal {
  const refusal: ApprovalRefusal = {
    status: null,
    code: null,
    message: null,
    retryAfterSeconds: null,
    lockoutMinutes: null,
    network: false,
  }
  if (!axios.isAxiosError(error)) return refusal
  const response = error.response
  if (!response) {
    refusal.network = true
    return refusal
  }
  refusal.status = response.status
  const data = response.data as { detail?: unknown } | undefined
  const detail = data && typeof data === 'object' ? data.detail : undefined
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const record = detail as Record<string, unknown>
    refusal.code = text(record.code)
    refusal.message = text(record.message)
    refusal.retryAfterSeconds = positiveNumber(record.retry_after)
    refusal.lockoutMinutes = positiveNumber(record.lockout_minutes)
  } else {
    refusal.message = text(detail)
  }
  if (refusal.retryAfterSeconds === null) {
    const headers = response.headers as Record<string, unknown> | undefined
    refusal.retryAfterSeconds = positiveNumber(headers?.['retry-after'])
  }
  return refusal
}

/**
 * The `/login` refusals the approval ends with: the account is checked again
 * when the approval is collected (and the 2FA start re-reads the challenge).
 * They belong to the login screen — `AccountLockedCard`, `IpNotAllowedCard`,
 * or the message under the password form — not to the approval card.
 */
const LOGIN_REFUSAL_CODES = new Set([
  'ACCOUNT_INACTIVE',
  'ACCOUNT_LOCKED',
  'NO_PROJECT_ASSIGNED',
  'IP_NOT_ALLOWED',
  'ROLE_NOT_AVAILABLE',
  'TWO_FACTOR_CHALLENGE_EXPIRED',
  'TWO_FACTOR_CHALLENGE_INVALID',
])

export function isLoginRefusal(refusal: ApprovalRefusal): boolean {
  return (
    (refusal.status === 401 || refusal.status === 403) &&
    refusal.code !== null &&
    LOGIN_REFUSAL_CODES.has(refusal.code)
  )
}

/** Worth another try on the next tick: no answer, or the gateway / Redis hiccuped. */
export function isTransientRefusal(refusal: ApprovalRefusal): boolean {
  return (
    refusal.network || refusal.status === 502 || refusal.status === 503 || refusal.status === 504
  )
}

/**
 * The phone cannot be asked at all: the mode's switch is off
 * (`404 APP_LOGIN_MODE_DISABLED`, or a bare 404 while the whole feature is
 * off) or this person has no switch / no phone (`409 APP_LOGIN_NOT_ENABLED`).
 * The 2FA step falls back to the Google Authenticator code.
 */
export function isModeUnavailable(refusal: ApprovalRefusal): boolean {
  if (refusal.status === 404) {
    return refusal.code === null || refusal.code === 'APP_LOGIN_MODE_DISABLED'
  }
  return refusal.status === 409 && refusal.code === 'APP_LOGIN_NOT_ENABLED'
}
