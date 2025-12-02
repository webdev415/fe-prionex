import { create } from 'zustand'
import { authApi } from '@/features/auth/api/authApi'
import { setAccessToken, getAccessToken } from '@/lib/api'
import type { User, LoginRequest, AuthErrorState } from '@/types/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  errorState: AuthErrorState | null
  lockoutMinutes: number | null
  pendingCredentials: LoginRequest | null

  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  forceLogin: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  errorState: null,
  lockoutMinutes: null,
  pendingCredentials: null,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null, errorState: null, pendingCredentials: null })

    try {
      const response = await authApi.login(credentials)
      const { token, user } = response.data

      setAccessToken(token)

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        errorState: null,
      })
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: {
            detail?: string | { code?: string; message?: string; lockout_minutes?: number }
          }
        }
      }
      const detail = err.response?.data?.detail

      // Handle structured error response: { code, message, lockout_minutes }
      let errorCode: string | null = null
      let errorMessage = 'Login failed'
      let lockoutMins: number | null = null

      if (typeof detail === 'object' && detail !== null) {
        errorCode = detail.code || null
        errorMessage = detail.message || 'Login failed'
        lockoutMins = detail.lockout_minutes || null
      } else if (typeof detail === 'string') {
        errorMessage = detail
      }

      // Map backend codes to frontend AuthErrorState
      let detectedErrorState: AuthErrorState | null = null
      let pendingCreds: LoginRequest | null = null

      if (errorCode === 'INVALID_CREDENTIALS') {
        detectedErrorState = 'INVALID_CREDENTIALS'
      } else if (errorCode === 'ACCOUNT_LOCKED') {
        detectedErrorState = 'ACCOUNT_LOCKED'
      } else if (errorCode === 'ACCOUNT_INACTIVE') {
        detectedErrorState = 'INVALID_CREDENTIALS' // Show as generic error
      } else if (errorCode === 'ALREADY_LOGGED_IN') {
        detectedErrorState = 'ALREADY_LOGGED_IN'
        pendingCreds = credentials // Store credentials for force login
      }

      set({
        isLoading: false,
        error: errorMessage,
        errorState: detectedErrorState,
        lockoutMinutes: lockoutMins,
        pendingCredentials: pendingCreds,
      })

      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })

    try {
      await authApi.logout()
    } finally {
      setAccessToken(null)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        errorState: null,
      })
    }
  },

  forceLogin: async () => {
    const { pendingCredentials } = get()

    if (!pendingCredentials) {
      set({ error: 'No pending credentials for force login' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const response = await authApi.forceLogin(pendingCredentials)
      const { token, user } = response.data

      setAccessToken(token)

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        errorState: null,
        pendingCredentials: null,
      })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | { message?: string } } } }
      const detail = err.response?.data?.detail
      const errorMessage =
        typeof detail === 'object' ? detail?.message : detail || 'Force login failed'

      set({
        isLoading: false,
        error: errorMessage,
      })
      throw error
    }
  },

  checkAuth: async () => {
    const token = getAccessToken()
    if (!token) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      return
    }

    // Validate token with backend to check if session is still valid
    try {
      const response = await authApi.validate()
      if (response.data.valid) {
        set({
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        // Token invalid or session expired - clear auth state
        setAccessToken(null)
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    } catch {
      // API call failed (401, network error, etc.) - clear auth state
      setAccessToken(null)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  clearError: () => {
    set({ error: null, errorState: null, lockoutMinutes: null, pendingCredentials: null })
  },
}))

export default useAuthStore
