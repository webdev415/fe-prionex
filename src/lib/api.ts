import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
})

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

/** Register a callback fired whenever the session is invalidated (401 / cross-tab logout). */
export const registerOnAuthCleared = (cb: (() => void) | null) => {
  onAuthCleared = cb
}

/** Register a callback fired on every successful (non-/auth/validate) response. */
export const registerOnAuthenticatedSuccess = (cb: (() => void) | null) => {
  onAuthenticatedSuccess = cb
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
      window.location.href = '/login'
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
// Response interceptor (KAN-760):
//   - on every successful response, fire the heartbeat-reset hook so the
//     2h idle timer is restarted (skips /auth/validate to avoid recursion)
//   - on 401 from a non-/auth/* URL, immediately clear the token and
//     redirect to /login. NO validate-dance — the previous validate-then-
//     redirect dance opened a 200-500ms window during which the UI flashed
//     error states before the redirect.
//   - all other errors bubble unchanged so feature code can handle them.
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || ''
    if (!url.includes('/auth/validate') && onAuthenticatedSuccess) {
      onAuthenticatedSuccess()
    }
    return response
  },
  (error: AxiosError) => {
    const originalRequest = error.config
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/')

    if (error.response?.status === 401 && !isAuthEndpoint) {
      triggerAuthExpired()
    }

    return Promise.reject(error)
  }
)

export default api
