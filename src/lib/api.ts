import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
})

// Token storage key
const TOKEN_KEY = 'prionex_token'

// Initialize token from localStorage (shared across tabs in the same browser)
let accessToken: string | null = localStorage.getItem(TOKEN_KEY)

export const setAccessToken = (token: string | null) => {
  accessToken = token
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const getAccessToken = () => {
  // Always check localStorage as source of truth
  // This ensures we get the latest token even if in-memory variable is stale
  const tokenFromStorage = localStorage.getItem(TOKEN_KEY)
  if (tokenFromStorage && tokenFromStorage !== accessToken) {
    // Sync in-memory token with localStorage
    accessToken = tokenFromStorage
  }
  return accessToken || tokenFromStorage
}

// Cross-tab sync: detect logout/login from other tabs
window.addEventListener('storage', (event) => {
  if (event.key !== TOKEN_KEY) return

  if (event.newValue === null) {
    // Token was removed in another tab (logout) — sync and redirect
    accessToken = null
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isImpersonating: false,
      impersonatedUser: null,
      originalAdminUser: null,
    })
    window.location.href = '/login'
  } else if (event.newValue !== accessToken) {
    // Token was set/changed in another tab (login) — sync in-memory
    accessToken = event.newValue
  }
})

// Race condition handling for token refresh
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback)
}

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

// Request interceptor - add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Refresh token from localStorage in case it was updated in another tab
    // This ensures we always have the latest token
    const currentToken = localStorage.getItem(TOKEN_KEY) || accessToken
    if (currentToken) {
      // Update in-memory token if it changed
      if (currentToken !== accessToken) {
        accessToken = currentToken
      }
      config.headers.Authorization = `Bearer ${currentToken}`
      if (import.meta.env.DEV) {
        console.log('[API Request]', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          fullURL: `${config.baseURL}${config.url}`,
          hasToken: !!currentToken,
        })
      }
    } else {
      console.warn('Request interceptor: No token available', { url: config.url })
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Extended request config with retry flag
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Response interceptor - handle errors and token refresh with race condition handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig | undefined

    // Skip token refresh for auth endpoints (login, logout, etc.)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/')

    // Handle 401 - Unauthorized (token expired) - but NOT for auth endpoints
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        // Another refresh is in progress - queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Get current token to validate
        const currentToken = getAccessToken()
        if (!currentToken) {
          throw new Error('No token available for validation')
        }

        // Attempt to validate the token
        const validateResponse = await axios.post(
          `${API_BASE_URL}/api/v1/auth/validate`,
          {},
          {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }
        )

        // Check if token is valid
        // The validate endpoint returns { valid: true, payload: {...}, expires_in: ... }
        // or { valid: false, error: "...", message: "..." }
        // It does NOT return a new token
        if (validateResponse.data.valid === true) {
          // Token is still valid - retry the original request with current token
          // This can happen if the 401 was due to a temporary issue
          originalRequest.headers.Authorization = `Bearer ${currentToken}`

          // Notify all waiting requests with current token
          onTokenRefreshed(currentToken)

          return api(originalRequest)
        } else {
          // Token is invalid or expired - clear and redirect
          throw new Error(validateResponse.data.message || 'Token validation failed')
        }
      } catch (refreshError) {
        // Refresh failed - clear token and redirect to login
        setAccessToken(null)
        refreshSubscribers = []

        // Clear auth state including impersonation
        useAuthStore.setState({
          user: null,
          isAuthenticated: false,
          isImpersonating: false,
          impersonatedUser: null,
          originalAdminUser: null,
        })

        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
