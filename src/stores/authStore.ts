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
  hasCheckedAuth: boolean

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
  hasCheckedAuth: false,

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
        hasCheckedAuth: true,
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
        hasCheckedAuth: false,
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
        hasCheckedAuth: true,
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
    const { hasCheckedAuth, isLoading } = get()

    // Prevent concurrent auth checks
    if (hasCheckedAuth || isLoading) {
      return
    }

    set({ isLoading: true })

    const token = getAccessToken()
    if (!token) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        hasCheckedAuth: true,
      })
      return
    }

    // Validate token with backend to check if session is still valid
    try {
      const validateResponse = await authApi.validate()
      if (validateResponse.data.valid) {
        // Token is valid, now fetch the current user data
        try {
          const userResponse = await authApi.me()
          const backendUser = userResponse.data

          // Map backend user data to frontend User type
          const user: User = {
            id: String(backendUser.id),
            username: backendUser.username,
            email: backendUser.email,
            firstName: backendUser.first_name,
            lastName: backendUser.last_name,
            projects: backendUser.projects?.map((p) => ({
              id: String(p.id),
              name: p.name,
              roles: [{ id: String(p.id), name: p.role_name }],
            })) || [],
            active_project_id: backendUser.active_project ? String(backendUser.active_project.id) : null,
            active_role_id: backendUser.role ? String(backendUser.role.id) : null,
            active_role_name: backendUser.role?.name || null,
            createdAt: backendUser.created_at,
            updatedAt: backendUser.created_at,
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            hasCheckedAuth: true,
          })
        } catch (userError) {
          // Failed to fetch user data, but token is valid - set authenticated without user
          console.warn('Failed to fetch user data:', userError)
          set({
            isAuthenticated: true,
            isLoading: false,
            hasCheckedAuth: true,
          })
        }
      } else {
        // Token invalid or session expired - clear auth state
        setAccessToken(null)
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          hasCheckedAuth: true,
        })
      }
    } catch {
      // API call failed (401, network error, etc.) - clear auth state
      setAccessToken(null)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        hasCheckedAuth: true,
      })
    }
  },

  clearError: () => {
    set({ error: null, errorState: null, lockoutMinutes: null, pendingCredentials: null })
  },
}))

export default useAuthStore
