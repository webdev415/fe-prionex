import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { buildLoginUrlWithReturn } from '@/features/auth/utils/safeReturnUrl'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

// Backend gunicorn timeout is 60s; FE must outlive it so a slow-but-eventually-
// successful request is not cancelled by axios before the server responds.
// 75s gives a 15s safety margin past the backend ceiling.
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 75000,
  withCredentials: true,
})

// Retry configuration for transient backend errors on safe (GET) requests.
// We do NOT auto-retry mutations (POST/PUT/PATCH/DELETE) here because most
// endpoints don't yet have idempotency keys — a retried POST would risk
// double-writes. Mutation-level retry is configured separately in main.tsx
// (network-error only, count=1) where the React Query layer can deduplicate.
const TRANSIENT_RETRY_STATUSES = new Set([502, 503, 504])
const TRANSIENT_RETRY_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])
const TRANSIENT_RETRY_MAX = 2
const TRANSIENT_RETRY_BASE_MS = 500

// Safe storage wrapper so tests (non-browser env) don't crash on localStorage access
const isBrowser =
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  typeof window.localStorage.getItem === 'function'
const memoryStorage: Record<string, string> = {}

const storage = {
  getItem(key: string): string | null {
    if (isBrowser) {
      return window.localStorage.getItem(key)
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null
  },
  setItem(key: string, value: string): void {
    if (isBrowser) {
      window.localStorage.setItem(key, value)
    } else {
      memoryStorage[key] = value
    }
  },
  removeItem(key: string): void {
    if (isBrowser) {
      window.localStorage.removeItem(key)
    } else {
      delete memoryStorage[key]
    }
  },
}

// Token storage key
const TOKEN_KEY = 'prionex_token'

// Initialize token from storage (shared across tabs in the same browser)
let accessToken: string | null = storage.getItem(TOKEN_KEY)

export const setAccessToken = (token: string | null) => {
  accessToken = token
  if (token) {
    storage.setItem(TOKEN_KEY, token)
  } else {
    storage.removeItem(TOKEN_KEY)
  }
}

export const getAccessToken = () => {
  // Always check storage as source of truth
  // This ensures we get the latest token even if in-memory variable is stale
  const tokenFromStorage = storage.getItem(TOKEN_KEY)
  if (tokenFromStorage && tokenFromStorage !== accessToken) {
    // Sync in-memory token with storage
    accessToken = tokenFromStorage
  }
  return accessToken || tokenFromStorage
}

// ---------------------------------------------------------------------------
// Callback registries — sibling modules (authStore, sessionHeartbeat) plug
// into these without creating a circular import here. This file has zero
// imports from app modules.
// ---------------------------------------------------------------------------
let onAuthCleared: (() => void) | null = null
let onAuthenticatedSuccess: (() => void) | null = null
// One-shot callbacks fired when auth-service is reachable again (a successful
// /users/* or /auth/* response) — used to dismiss the "reconnecting" toast.
let onceAuthSuccess: Array<() => void> = []

/** Register a callback fired whenever the session is invalidated (401 / cross-tab logout). */
export const registerOnAuthCleared = (cb: (() => void) | null) => {
  onAuthCleared = cb
}

/** Register a callback fired on every successful (non-/auth/validate) response. */
export const registerOnAuthenticatedSuccess = (cb: (() => void) | null) => {
  onAuthenticatedSuccess = cb
}

/** Run `cb` once, the next time auth-service responds successfully. */
export const runOnceOnNextAuthSuccess = (cb: () => void) => {
  onceAuthSuccess.push(cb)
}

/**
 * Tear down the user's session and redirect to /login.
 *
 * Single entry point used by:
 *   - the 401 response interceptor below
 *   - the cross-tab storage listener below
 *   - sessionHeartbeat (when /auth/validate confirms the Redis session is gone)
 */
export const triggerAuthExpired = () => {
  setAccessToken(null)
  onAuthCleared?.()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

// Cross-tab sync: detect logout/login from other tabs (browser only)
if (isBrowser && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return

    if (event.newValue === null) {
      // Token was removed in another tab (logout) — sync and redirect.
      // Storage is already cleared by the other tab, so do NOT call
      // setAccessToken(null) here (that would write again). Just null
      // the in-memory copy + fire callbacks + redirect.
      accessToken = null
      onAuthCleared?.()
      window.location.href = buildLoginUrlWithReturn()
    } else if (event.newValue !== accessToken) {
      // Token was set/changed in another tab (login) — sync in-memory
      accessToken = event.newValue
    }
  })
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token to outgoing requests.
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Refresh token from localStorage in case it was updated in another tab
    const currentToken = storage.getItem(TOKEN_KEY) || accessToken
    if (currentToken) {
      if (currentToken !== accessToken) {
        accessToken = currentToken
      }
      config.headers.Authorization = `Bearer ${currentToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---------------------------------------------------------------------------
// Internal config type so we can stash a retry counter on the request object.
// ---------------------------------------------------------------------------
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _transientRetryCount?: number
}

function isTransientFailure(error: AxiosError): boolean {
  if (error.response) {
    return TRANSIENT_RETRY_STATUSES.has(error.response.status)
  }
  // No response = network error / timeout / DNS / refused. Axios surfaces
  // the cause via `code`; treat the standard transient codes as retryable.
  return Boolean(error.code && TRANSIENT_RETRY_CODES.has(error.code))
}

/**
 * A DEFINITIVE auth failure = the server actively rejected the token (HTTP 401).
 * Everything else (network error, timeout, 5xx, unknown) is transient/unreachable
 * and must NOT be treated as an invalid session.
 */
export const isDefinitiveAuthFailure = (e: unknown): boolean =>
  axios.isAxiosError(e) && e.response?.status === 401

function shouldRetryTransient(
  error: AxiosError,
  config: RetryableRequestConfig | undefined
): boolean {
  if (!config) return false
  const method = (config.method || 'get').toLowerCase()
  // Only safe methods. Mutations may not be idempotent, so we let the React
  // Query mutation-default layer handle them (network-error only, 1 try).
  if (method !== 'get') return false
  if (config.url?.includes('/auth/')) return false
  const count = config._transientRetryCount ?? 0
  if (count >= TRANSIENT_RETRY_MAX) return false
  return isTransientFailure(error)
}

// ---------------------------------------------------------------------------
// Response interceptor:
//   - on every successful response, fire the heartbeat-reset hook so the
//     2h idle timer is restarted (skips /auth/validate to avoid recursion)
//   - on 401 from a non-/auth/* URL, immediately clear the token and
//     redirect to /login (KAN-760, no validate-dance / no error-flash window).
//   - on transient 5xx (502/503/504) or network errors for GET requests,
//     retry with exponential backoff (500ms → 1s → 2s, max 2 retries).
//     Mutations are NOT retried here — their retry policy lives at the
//     React Query layer.
//   - all other errors bubble unchanged so feature code can handle them.
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || ''
    if (!url.includes('/auth/validate') && onAuthenticatedSuccess) {
      onAuthenticatedSuccess()
    }
    // Fire one-shot callbacks only when auth-service itself responds. Other
    // services stay up during an auth-only outage, so "any success" would
    // wrongly signal recovery; a /users/* or /auth/* success is the real
    // "auth is back" signal. Clear the queue before running (no re-loop) and
    // guard each callback so a throwing hook can't fail a real response.
    if ((url.includes('/users/') || url.includes('/auth/')) && onceAuthSuccess.length) {
      const queued = onceAuthSuccess
      onceAuthSuccess = []
      queued.forEach((cb) => {
        try {
          cb()
        } catch {
          /* a side-task must never break a real response */
        }
      })
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/')

    if (error.response?.status === 401 && !isAuthEndpoint) {
      triggerAuthExpired()
      return Promise.reject(error)
    }

    if (shouldRetryTransient(error, originalRequest) && originalRequest) {
      originalRequest._transientRetryCount = (originalRequest._transientRetryCount ?? 0) + 1
      const delay = TRANSIENT_RETRY_BASE_MS * 2 ** (originalRequest._transientRetryCount - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return api(originalRequest)
    }

    return Promise.reject(error)
  }
)

export default api
