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

  // Impersonation state
  isImpersonating: boolean
  impersonatedUser: User | null
  originalAdminUser: User | null

  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  forceLogin: () => Promise<void>
  checkAuth: () => Promise<void>
  refreshUser: () => Promise<void>
  updateCurrentUser: (updates: Partial<User>) => void
  clearError: () => void
  startImpersonation: (userId: number) => Promise<void>
  exitImpersonation: () => Promise<void>
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

  // Impersonation initial state
  isImpersonating: false,
  impersonatedUser: null,
  originalAdminUser: null,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null, errorState: null, pendingCredentials: null })

    try {
      const response = await authApi.login(credentials)
      const { token, user: loginUser } = response.data

      setAccessToken(token)

      // Try to fetch full user details with permissions
      // If this fails (e.g., user has no project/role assigned), fall back to login response data
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        // Map backend user data to frontend User type with permissions
        const user: User = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email,
          firstName: backendUser.first_name,
          lastName: backendUser.last_name,
          projects:
            backendUser.projects?.map((p) => ({
              id: String(p.id),
              name: p.name,
              code: p.code, // Preserve project code from backend
              roles: [{ id: String(p.id), name: p.role_name }],
            })) || [],
          active_project_id: backendUser.active_project
            ? String(backendUser.active_project.id)
            : null,
          active_role_id: backendUser.role ? String(backendUser.role.id) : null,
          active_role_name: backendUser.role?.name || null,
          permissions: backendUser.permissions || [],
          createdAt: backendUser.created_at,
          updatedAt: backendUser.created_at,
          asterisk_extension: backendUser.asterisk_extension,
          is_agent: backendUser.is_agent,
          agent_status: backendUser.agent_status,
          timezone: backendUser.timezone,
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          hasCheckedAuth: true,
        })
      } catch (meError) {
        // Failed to fetch /users/me - fall back to login response data
        console.warn('Failed to fetch full user details, using login response data:', meError)

        // Map login response user data to frontend User type (without permissions)
        const user: User = {
          id: String(loginUser.id),
          username: loginUser.username,
          email: undefined,
          firstName: undefined,
          lastName: undefined,
          projects:
            loginUser.projects?.map((projectId) => ({
              id: String(projectId),
              name: '',
              roles: [],
            })) || [],
          active_project_id: loginUser.active_project_id
            ? String(loginUser.active_project_id)
            : null,
          active_role_id: loginUser.active_role_id ? String(loginUser.active_role_id) : null,
          active_role_name: loginUser.active_role_name || null,
          permissions: [], // No permissions available from login response
          createdAt: undefined,
          updatedAt: undefined,
        }

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

      // Clear impersonation sessionStorage
      sessionStorage.removeItem('impersonation_original_admin')

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        errorState: null,
        hasCheckedAuth: false,
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

    set({ isLoading: true, error: null })

    try {
      const response = await authApi.forceLogin(pendingCredentials)
      const { token, user: loginUser } = response.data

      setAccessToken(token)

      // Try to fetch full user details with permissions
      // If this fails (e.g., user has no project/role assigned), fall back to login response data
      try {
        const userResponse = await authApi.me()
        const backendUser = userResponse.data

        // Map backend user data to frontend User type with permissions
        const user: User = {
          id: String(backendUser.id),
          username: backendUser.username,
          email: backendUser.email,
          firstName: backendUser.first_name,
          lastName: backendUser.last_name,
          projects:
            backendUser.projects?.map((p) => ({
              id: String(p.id),
              name: p.name,
              code: p.code, // Preserve project code from backend
              roles: [{ id: String(p.id), name: p.role_name }],
            })) || [],
          active_project_id: backendUser.active_project
            ? String(backendUser.active_project.id)
            : null,
          active_role_id: backendUser.role ? String(backendUser.role.id) : null,
          active_role_name: backendUser.role?.name || null,
          permissions: backendUser.permissions || [],
          createdAt: backendUser.created_at,
          updatedAt: backendUser.created_at,
          asterisk_extension: backendUser.asterisk_extension,
          is_agent: backendUser.is_agent,
          agent_status: backendUser.agent_status,
          timezone: backendUser.timezone,
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          errorState: null,
          pendingCredentials: null,
          hasCheckedAuth: true,
        })
      } catch (meError) {
        // Failed to fetch /users/me - fall back to login response data
        console.warn('Failed to fetch full user details, using login response data:', meError)

        // Map login response user data to frontend User type (without permissions)
        const user: User = {
          id: String(loginUser.id),
          username: loginUser.username,
          email: undefined,
          firstName: undefined,
          lastName: undefined,
          projects:
            loginUser.projects?.map((projectId) => ({
              id: String(projectId),
              name: '',
              roles: [],
            })) || [],
          active_project_id: loginUser.active_project_id
            ? String(loginUser.active_project_id)
            : null,
          active_role_id: loginUser.active_role_id ? String(loginUser.active_role_id) : null,
          active_role_name: loginUser.active_role_name || null,
          permissions: [], // No permissions available from login response
          createdAt: undefined,
          updatedAt: undefined,
        }

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

          // Map backend user data to frontend User type
          const user: User = {
            id: String(backendUser.id),
            username: backendUser.username,
            email: backendUser.email,
            firstName: backendUser.first_name,
            lastName: backendUser.last_name,
            projects:
              backendUser.projects?.map((p) => ({
                id: String(p.id),
                name: p.name,
                roles: [{ id: String(p.id), name: p.role_name }],
              })) || [],
            active_project_id: backendUser.active_project
              ? String(backendUser.active_project.id)
              : null,
            active_role_id: backendUser.role ? String(backendUser.role.id) : null,
            active_role_name: backendUser.role?.name || null,
            permissions: backendUser.permissions || [],
            createdAt: backendUser.created_at,
            updatedAt: backendUser.created_at,
            asterisk_extension: backendUser.asterisk_extension,
            is_agent: backendUser.is_agent,
            agent_status: backendUser.agent_status,
            timezone: backendUser.timezone,
          }

          if (isImpersonating) {
            // In impersonation mode - restore original admin from sessionStorage
            let originalAdmin: User | null = null
            try {
              const storedAdmin = sessionStorage.getItem('impersonation_original_admin')
              if (storedAdmin) {
                originalAdmin = JSON.parse(storedAdmin) as User
              }
            } catch {
              // Failed to parse stored admin, will be null
            }

            set({
              user, // This is the impersonated user
              isAuthenticated: true,
              isImpersonating: true,
              impersonatedUser: user,
              originalAdminUser: originalAdmin, // Restored from sessionStorage
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
        } catch (userError) {
          // Failed to fetch user data, but token is valid
          // Fallback: Extract basic user info from JWT token
          console.warn('Failed to fetch user data:', userError)

          // Parse JWT token to extract basic user information
          const tokenPayload = parseJwt(token)
          if (tokenPayload && tokenPayload.user_id && tokenPayload.username) {
            // Create minimal user object from JWT token data
            const user: User = {
              id: String(tokenPayload.user_id),
              username: String(tokenPayload.username),
              email: undefined,
              firstName: undefined,
              lastName: undefined,
              projects: tokenPayload.project_ids
                ? (tokenPayload.project_ids as number[]).map((projectId) => ({
                    id: String(projectId),
                    name: '',
                    roles: [],
                  }))
                : [],
              active_project_id: tokenPayload.active_project_id
                ? String(tokenPayload.active_project_id)
                : null,
              active_role_id: tokenPayload.active_role_id
                ? String(tokenPayload.active_role_id)
                : null,
              active_role_name: tokenPayload.active_role_name
                ? String(tokenPayload.active_role_name)
                : null,
              permissions: [], // No permissions available from token
              timezone: tokenPayload.timezone ? String(tokenPayload.timezone) : undefined,
              createdAt: undefined,
              updatedAt: undefined,
            }

            if (isImpersonating) {
              // In impersonation mode - restore original admin from sessionStorage
              let originalAdmin: User | null = null
              try {
                const storedAdmin = sessionStorage.getItem('impersonation_original_admin')
                if (storedAdmin) {
                  originalAdmin = JSON.parse(storedAdmin) as User
                }
              } catch {
                // Failed to parse stored admin, will be null
              }

              set({
                user, // This is the impersonated user (from token)
                isAuthenticated: true,
                isImpersonating: true,
                impersonatedUser: user,
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
            sessionStorage.removeItem('impersonation_original_admin')

            set({
              user: null,
              isAuthenticated: true,
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
        projects:
          backendUser.projects?.map((p) => ({
            id: String(p.id),
            name: p.name,
            roles: [{ id: String(p.id), name: p.role_name }],
          })) || [],
        active_project_id: backendUser.active_project
          ? String(backendUser.active_project.id)
          : null,
        active_role_id: backendUser.role ? String(backendUser.role.id) : null,
        active_role_name: backendUser.role?.name || null,
        permissions: backendUser.permissions || [],
        asterisk_extension: backendUser.asterisk_extension,
        is_agent: backendUser.is_agent,
        agent_status: backendUser.agent_status,
        timezone: backendUser.timezone, // ✅ Add timezone!
        createdAt: backendUser.created_at,
        updatedAt: backendUser.created_at,
      }

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
    set({ error: null, errorState: null, lockoutMinutes: null, pendingCredentials: null })
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

      // Store original admin in sessionStorage to survive page refresh
      if (originalAdmin) {
        sessionStorage.setItem('impersonation_original_admin', JSON.stringify(originalAdmin))
      }

      // Map backend impersonated user data to frontend User type
      // Note: Backend returns impersonated_user, active_project, and permissions separately
      const impersonatedUserMapped: User = {
        id: String(impersonated_user.id),
        username: impersonated_user.username,
        email: impersonated_user.email,
        firstName: impersonated_user.first_name,
        lastName: impersonated_user.last_name,
        // Create a single-item projects array with the active project
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
        permissions: permissions || [],
        createdAt: undefined,
        updatedAt: undefined,
      }

      // Update state with impersonated user details
      set({
        isImpersonating: true,
        impersonatedUser: impersonatedUserMapped,
        originalAdminUser: originalAdmin,
        user: impersonatedUserMapped, // Current user becomes impersonated user
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

      // Map backend admin user data to frontend User type
      const adminUserMapped: User = {
        id: String(admin_user.id),
        username: admin_user.username,
        email: admin_user.email,
        firstName: admin_user.first_name,
        lastName: admin_user.last_name,
        projects:
          admin_user.projects?.map(
            (p: { id: number; name: string; code: string; role_name: string }) => ({
              id: String(p.id),
              name: p.name,
              roles: [{ id: String(p.id), name: p.role_name }],
            })
          ) || [],
        active_project_id: admin_user.active_project ? String(admin_user.active_project.id) : null,
        active_role_id: admin_user.role ? String(admin_user.role.id) : null,
        active_role_name: admin_user.role?.name || null,
        permissions: admin_user.permissions || [],
        createdAt: admin_user.created_at,
        updatedAt: admin_user.created_at,
        asterisk_extension: admin_user.asterisk_extension,
        is_agent: admin_user.is_agent,
        agent_status: admin_user.agent_status,
        timezone: admin_user.timezone,
      }

      // Clear stored admin from sessionStorage
      sessionStorage.removeItem('impersonation_original_admin')

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

export default useAuthStore
