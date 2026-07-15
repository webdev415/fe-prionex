import { create } from 'zustand'
import { authApi } from '@/features/auth/api/authApi'
import { getAccessToken, registerOnAuthCleared, setAccessToken } from '@/lib/api'
import { applyPersistedLanguageFromServer } from '@/lib/i18n'
import { cancelSessionHeartbeat, scheduleSessionHeartbeat } from '@/lib/sessionHeartbeat'
import type { User, LoginRequest, AuthErrorState } from '@/types/api'
import {
  buildUserFromJwtToken,
  mapBackendUserToUser,
  mergeUserFromProjectsResponse,
  toLoginUserFallback,
} from '@/lib/mapBackendUser'

export { mapBackendUserToUser } from '@/lib/mapBackendUser'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  errorState: AuthErrorState | null
  lockoutMinutes: number | null
  pendingCredentials: LoginRequest | null
  hasCheckedAuth: boolean

  // 2FA challenge state — set when /login replies with two_factor_required
  twoFactorToken: string | null
  twoFactorUsername: string | null

  // Impersonation state
  isImpersonating: boolean
  impersonatedUser: User | null
  originalAdminUser: User | null

  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  forceLogin: () => Promise<void>
  verifyTwoFactor: (code: string) => Promise<void>
  cancelTwoFactor: () => void
  checkAuth: () => Promise<void>
  refreshUser: () => Promise<void>
  updateCurrentUser: (updates: Partial<User>) => void
  clearError: () => void
  startImpersonation: (userId: number) => Promise<void>
  exitImpersonation: () => Promise<void>
}

/** Load full profile from /users/me, or JWT + /users/me/projects when /me fails. */
async function resolveAuthUser(
  token: string,
  loginUser?: ReturnType<typeof toLoginUserFallback>
): Promise<User> {
  let user: User
  try {
    const userResponse = await authApi.me()
    applyPersistedLanguageFromServer(userResponse.data.language)
    user = mapBackendUserToUser(userResponse.data)
  } catch {
    user = buildUserFromJwtToken(token, loginUser)
    try {
      const projectsResponse = await authApi.myProjects()
      user = mergeUserFromProjectsResponse(user, projectsResponse.data)
    } catch {
      // Keep JWT-derived user (permissions, names from login payload)
    }
  }
  // KAN-757: per-tab access ceilings live only on the JWT (not /users/me), so
  // overlay them here regardless of which profile source won.
  user.tab_access_levels = extractTabAccessLevels(token)
  return user
}

/** Read the `tab_access_levels` claim off the JWT (empty map when absent). */
function extractTabAccessLevels(token: string): Record<string, string> {
  const payload = parseJwt(token)
  const levels = payload?.tab_access_levels
  if (levels && typeof levels === 'object' && !Array.isArray(levels)) {
    return levels as Record<string, string>
  }
  return {}
}

// Helper function to parse JWT token
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload) as Record<string, unknown>
  } catch {
    return null
  }
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

  // 2FA challenge initial state
  twoFactorToken: null,
  twoFactorUsername: null,

  // Impersonation initial state
  isImpersonating: false,
  impersonatedUser: null,
  originalAdminUser: null,

  login: async (credentials: LoginRequest) => {
    set({
      isLoading: true,
      error: null,
      errorState: null,
      pendingCredentials: null,
      twoFactorToken: null,
      twoFactorUsername: null,
    })

    try {
      const response = await authApi.login(credentials)
      const { token, user: loginUser, two_factor_required, two_factor_token } = response.data

      // 2FA branch — password OK but the second factor is required.
      if (two_factor_required && two_factor_token) {
        set({
          isLoading: false,
          twoFactorToken: two_factor_token,
          twoFactorUsername: credentials.username,
          errorState: 'TWO_FACTOR_REQUIRED',
        })
        return
      }

      if (!token || !loginUser) {
        throw new Error('Login response missing token or user')
      }

      setAccessToken(token)
      scheduleSessionHeartbeat()

      // Try to fetch full user details with permissions
      // If this fails (e.g., user has no project/role assigned), fall back to login response data
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        const user = mapBackendUserToUser(backendUser)
        applyPersistedLanguageFromServer(backendUser.language)

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          hasCheckedAuth: true,
        })
      } catch {
        const user = await resolveAuthUser(
          token,
          toLoginUserFallback(loginUser as unknown as Record<string, unknown>)
        )

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          hasCheckedAuth: true,
        })
      }
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
      } else if (errorCode === 'IP_NOT_ALLOWED') {
        detectedErrorState = 'IP_NOT_ALLOWED'
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
      cancelSessionHeartbeat()

      // Clear impersonation localStorage
      localStorage.removeItem('impersonation_original_admin')
      localStorage.removeItem('impersonated_user_profile')

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        errorState: null,
        hasCheckedAuth: false,
        twoFactorToken: null,
        twoFactorUsername: null,
        // Clear impersonation state
        isImpersonating: false,
        impersonatedUser: null,
        originalAdminUser: null,
      })
    }
  },

  forceLogin: async () => {
    const { pendingCredentials } = get()

    if (!pendingCredentials) {
      set({ error: 'No pending credentials for force login' })
      return
    }

    set({ isLoading: true, error: null, twoFactorToken: null, twoFactorUsername: null })

    try {
      const response = await authApi.forceLogin(pendingCredentials)
      const { token, user: loginUser, two_factor_required, two_factor_token } = response.data

      // 2FA branch (also possible after force-login)
      if (two_factor_required && two_factor_token) {
        set({
          isLoading: false,
          twoFactorToken: two_factor_token,
          twoFactorUsername: pendingCredentials.username,
          errorState: 'TWO_FACTOR_REQUIRED',
        })
        return
      }

      if (!token || !loginUser) {
        throw new Error('Force login response missing token or user')
      }

      setAccessToken(token)
      scheduleSessionHeartbeat()

      // Try to fetch full user details with permissions
      // If this fails (e.g., user has no project/role assigned), fall back to login response data
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        const user = mapBackendUserToUser(backendUser)
        applyPersistedLanguageFromServer(backendUser.language)

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          pendingCredentials: null,
          hasCheckedAuth: true,
        })
      } catch {
        const user = await resolveAuthUser(
          token,
          toLoginUserFallback(loginUser as unknown as Record<string, unknown>)
        )

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          pendingCredentials: null,
          hasCheckedAuth: true,
        })
      }
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

  verifyTwoFactor: async (code: string) => {
    const { twoFactorToken } = get()

    if (!twoFactorToken) {
      set({ error: '2FA challenge expired. Please log in again.', errorState: null })
      throw new Error('No active 2FA challenge')
    }

    set({ isLoading: true, error: null })

    try {
      const response = await authApi.verifyTwoFactor({
        two_factor_token: twoFactorToken,
        code,
      })
      const { token, user: loginUser } = response.data

      if (!token || !loginUser) {
        throw new Error('Verify-2FA response missing token or user')
      }

      setAccessToken(token)
      scheduleSessionHeartbeat()

      // Mirrors the `login()` success path: prefer /users/me for full
      // profile + permissions, fall back to login response if it fails.
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        const user = mapBackendUserToUser(backendUser)
        applyPersistedLanguageFromServer(backendUser.language)

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          twoFactorToken: null,
          twoFactorUsername: null,
          pendingCredentials: null,
          hasCheckedAuth: true,
        })
      } catch {
        const user = {
          ...(await resolveAuthUser(
            token,
            toLoginUserFallback(loginUser as unknown as Record<string, unknown>)
          )),
          twoFactorEnabled: true,
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          twoFactorToken: null,
          twoFactorUsername: null,
          pendingCredentials: null,
          hasCheckedAuth: true,
        })
      }
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number
          data?: { detail?: string | { code?: string; message?: string } }
        }
      }
      const detail = err.response?.data?.detail
      let errorCode: string | null = null
      let errorMessage = 'Verification failed'

      if (typeof detail === 'object' && detail !== null) {
        errorCode = detail.code || null
        errorMessage = detail.message || errorMessage
      } else if (typeof detail === 'string') {
        errorMessage = detail
      }

      // If the challenge expired or got invalidated, kick the user back
      // to the password screen so they re-enter credentials.
      const challengeDead =
        errorCode === 'TWO_FACTOR_CHALLENGE_EXPIRED' || errorCode === 'TWO_FACTOR_CHALLENGE_INVALID'

      set({
        isLoading: false,
        error: errorMessage,
        errorState: challengeDead ? null : 'TWO_FACTOR_REQUIRED',
        twoFactorToken: challengeDead ? null : get().twoFactorToken,
        twoFactorUsername: challengeDead ? null : get().twoFactorUsername,
      })

      throw error
    }
  },

  cancelTwoFactor: () => {
    set({
      twoFactorToken: null,
      twoFactorUsername: null,
      errorState: null,
      error: null,
      pendingCredentials: null,
    })
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
        isImpersonating: false,
        impersonatedUser: null,
        originalAdminUser: null,
      })
      return
    }

    // Decode token to check for impersonation context
    const tokenPayload = parseJwt(token)
    const isImpersonating = tokenPayload?.is_impersonation === true

    // Validate token with backend to check if session is still valid
    try {
      const validateResponse = await authApi.validate()
      if (validateResponse.data.valid) {
        // Token is valid, now fetch the current user data
        try {
          const userResponse = await authApi.me()
          const backendUser = userResponse.data

          const user = mapBackendUserToUser(backendUser)
          applyPersistedLanguageFromServer(backendUser.language)

          if (isImpersonating) {
            // In impersonation mode - restore original admin + target profile from localStorage
            let originalAdmin: User | null = null
            try {
              const storedAdmin = localStorage.getItem('impersonation_original_admin')
              if (storedAdmin) {
                originalAdmin = JSON.parse(storedAdmin) as User
              }
            } catch {
              // Failed to parse stored admin, will be null
            }
            let cachedImpersonated: User | null = null
            try {
              const stored = localStorage.getItem('impersonated_user_profile')
              if (stored) {
                cachedImpersonated = JSON.parse(stored) as User
              }
            } catch {
              // Falls back to /me-derived user below
            }

            set({
              user, // app permission gates read this; /me returns target role/perms
              isAuthenticated: true,
              isImpersonating: true,
              impersonatedUser: cachedImpersonated || user,
              originalAdminUser: originalAdmin, // Restored from localStorage
              isLoading: false,
              hasCheckedAuth: true,
            })
          } else {
            // Normal auth
            set({
              user,
              isAuthenticated: true,
              isImpersonating: false,
              impersonatedUser: null,
              originalAdminUser: null,
              isLoading: false,
              hasCheckedAuth: true,
            })
          }
        } catch {
          const tokenPayload = parseJwt(token)
          if (tokenPayload && tokenPayload.user_id && tokenPayload.username) {
            const user = await resolveAuthUser(token)
            if (tokenPayload.timezone) {
              user.timezone = String(tokenPayload.timezone)
            }

            if (isImpersonating) {
              // In impersonation mode - restore original admin + target profile from localStorage
              let originalAdmin: User | null = null
              try {
                const storedAdmin = localStorage.getItem('impersonation_original_admin')
                if (storedAdmin) {
                  originalAdmin = JSON.parse(storedAdmin) as User
                }
              } catch {
                // Failed to parse stored admin, will be null
              }
              let cachedImpersonated: User | null = null
              try {
                const stored = localStorage.getItem('impersonated_user_profile')
                if (stored) {
                  cachedImpersonated = JSON.parse(stored) as User
                }
              } catch {
                // Falls back to /me-derived user below
              }

              set({
                user, // app permission gates read this; token has target role/perms
                isAuthenticated: true,
                isImpersonating: true,
                impersonatedUser: cachedImpersonated || user,
                originalAdminUser: originalAdmin,
                isLoading: false,
                hasCheckedAuth: true,
              })
            } else {
              // Normal auth with fallback user data
              set({
                user,
                isAuthenticated: true,
                isImpersonating: false,
                impersonatedUser: null,
                originalAdminUser: null,
                isLoading: false,
                hasCheckedAuth: true,
              })
            }
          } else {
            // Cannot extract user info from token - clear all state
            console.error('Failed to extract user info from JWT token')
            localStorage.removeItem('impersonation_original_admin')
            localStorage.removeItem('impersonated_user_profile')

            setAccessToken(null)
            cancelSessionHeartbeat()
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              hasCheckedAuth: true,
              isImpersonating: false,
              impersonatedUser: null,
              originalAdminUser: null,
            })
          }
        }
      } else {
        // Token invalid or session expired - clear auth state
        setAccessToken(null)
        cancelSessionHeartbeat()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          hasCheckedAuth: true,
          isImpersonating: false,
          impersonatedUser: null,
          originalAdminUser: null,
        })
      }
    } catch {
      // API call failed (401, network error, etc.) - clear auth state
      setAccessToken(null)
      cancelSessionHeartbeat()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        hasCheckedAuth: true,
        isImpersonating: false,
        impersonatedUser: null,
        originalAdminUser: null,
      })
    }
  },

  refreshUser: async () => {
    const { isAuthenticated } = get()

    if (!isAuthenticated) {
      return
    }

    const token = getAccessToken()
    if (!token) return

    try {
      const user = await resolveAuthUser(token)
      set({ user })
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  },

  updateCurrentUser: (updates: Partial<User>) => {
    const { user } = get()
    if (user) {
      set({ user: { ...user, ...updates } })
    }
  },

  clearError: () => {
    set({
      error: null,
      errorState: null,
      lockoutMinutes: null,
      pendingCredentials: null,
      twoFactorToken: null,
      twoFactorUsername: null,
    })
  },

  startImpersonation: async (userId: number) => {
    try {
      set({ isLoading: true, error: null, errorState: null })

      // Call backend API
      const response = await authApi.impersonate(String(userId))

      // Backend returns: { success: bool, message: string, data: { impersonation_token: string, impersonated_user: {...} } }
      // Validate response structure
      if (
        !response.data ||
        !response.data.data ||
        !response.data.data.impersonation_token ||
        !response.data.data.impersonated_user
      ) {
        throw new Error('Invalid response from impersonation API')
      }

      const { impersonation_token, impersonated_user, active_project, permissions } =
        response.data.data

      // Store the new impersonation token
      setAccessToken(impersonation_token)

      // Preserve original admin user
      const originalAdmin = get().user

      // Store original admin in localStorage to survive page refresh and work across tabs
      if (originalAdmin) {
        localStorage.setItem('impersonation_original_admin', JSON.stringify(originalAdmin))
      }

      // Build target user profile from the impersonate API response (the user we're VIEWING AS).
      // The backend's /me endpoint returns the impersonator's identity (user_id in the JWT is
      // the admin's id), so we cannot rely on /me for first_name / last_name of the target.
      // The impersonate endpoint already returns the target's full name fields.
      const targetUserProfile: User = {
        id: String(impersonated_user.id),
        username: impersonated_user.username,
        email: impersonated_user.email,
        firstName: impersonated_user.first_name,
        lastName: impersonated_user.last_name,
        fullName:
          [impersonated_user.first_name, impersonated_user.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || undefined,
        projects: [
          {
            id: String(active_project.project_id),
            name: active_project.project_name,
            roles: [{ id: String(active_project.role_id), name: active_project.role_name }],
          },
        ],
        active_project_id: String(active_project.project_id),
        active_role_id: String(active_project.role_id),
        active_role_name: active_project.role_name,
        active_department_id: null,
        permissions: permissions || [],
        is_agent: false,
        agent_status: 'offline',
      }

      // Cache the target's profile so the banner survives a page refresh
      // (the JWT carries impersonated_username but not first/last name).
      localStorage.setItem('impersonated_user_profile', JSON.stringify(targetUserProfile))

      // Use /me to drive the in-app `user` slot — it returns the impersonator's identity
      // but with the target's active_role / permissions, which is what app permission
      // gates read. Fall back to the target profile if /me fails.
      let userForApp: User
      try {
        const meResponse = await authApi.me()
        userForApp = mapBackendUserToUser(meResponse.data)
      } catch {
        userForApp = targetUserProfile
      }

      set({
        isImpersonating: true,
        impersonatedUser: targetUserProfile,
        originalAdminUser: originalAdmin,
        user: userForApp,
        isLoading: false,
      })
    } catch (error: unknown) {
      let errorMessage = 'Failed to impersonate user'
      let errorState: AuthErrorState | null = null

      // Handle specific error cases
      const err = error as {
        response?: { status?: number; data?: { detail?: string | { message?: string } } }
      }

      if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to impersonate users'
      } else if (err.response?.status === 404) {
        errorMessage = 'User not found or has no project assignments'
      } else if (err.response?.status === 429) {
        errorMessage = 'Too many impersonation attempts. Please try again later.'
        errorState = 'TOO_MANY_ATTEMPTS'
      } else if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        errorMessage = typeof detail === 'string' ? detail : detail.message || errorMessage
      }

      set({
        error: errorMessage,
        errorState: errorState,
        isLoading: false,
      })

      throw new Error(errorMessage)
    }
  },

  exitImpersonation: async () => {
    try {
      set({ isLoading: true, error: null, errorState: null })

      // Call backend API
      const response = await authApi.exitImpersonation()

      // Backend returns: { success: bool, message: string, data: { admin_token: string, admin_user: {...} } }
      // Validate response structure
      if (
        !response.data ||
        !response.data.data ||
        !response.data.data.admin_token ||
        !response.data.data.admin_user
      ) {
        throw new Error('Invalid response from exit impersonation API')
      }

      const { admin_token, admin_user } = response.data.data

      // Store the new admin token
      setAccessToken(admin_token)

      // Restore original admin user (prefer from state, fallback to response)
      const originalAdmin = get().originalAdminUser

      const adminUserMapped = mapBackendUserToUser(admin_user)

      // Clear stored admin from localStorage
      localStorage.removeItem('impersonation_original_admin')
      localStorage.removeItem('impersonated_user_profile')

      set({
        isImpersonating: false,
        impersonatedUser: null,
        originalAdminUser: null,
        user: originalAdmin || adminUserMapped, // Restore admin (prefer from state, fallback to response)
        isLoading: false,
      })
    } catch (error: unknown) {
      let errorMessage = 'Failed to exit impersonation'

      const err = error as { response?: { data?: { detail?: string | { message?: string } } } }

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        errorMessage = typeof detail === 'string' ? detail : detail.message || errorMessage
      }

      set({
        error: errorMessage,
        isLoading: false,
      })

      throw new Error(errorMessage)
    }
  },
}))

// KAN-760: when api.ts (401 interceptor / cross-tab storage event /
// sessionHeartbeat) tears down the session, also wipe the zustand auth
// state so React components don't keep rendering as authenticated until
// the navigation completes.
registerOnAuthCleared(() => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isImpersonating: false,
    impersonatedUser: null,
    originalAdminUser: null,
  })
})

export default useAuthStore
