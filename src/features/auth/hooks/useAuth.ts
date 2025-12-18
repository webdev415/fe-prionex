import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { LoginRequest } from '@/types/api'

export function useAuth() {
  const navigate = useNavigate()

  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    errorState,
    lockoutMinutes,
    // Impersonation state
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    // Methods
    login: storeLogin,
    logout: storeLogout,
    forceLogin: storeForceLogin,
    checkAuth,
    clearError,
    startImpersonation: storeStartImpersonation,
    exitImpersonation: storeExitImpersonation,
  } = useAuthStore()

  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        await storeLogin(credentials)
        navigate('/dashboard/client')
      } catch {
        // Error is handled by the store
      }
    },
    [storeLogin, navigate]
  )

  const logout = useCallback(async () => {
    await storeLogout()
    navigate('/login')
  }, [storeLogout, navigate])

  const forceLogin = useCallback(async () => {
    try {
      await storeForceLogin()
      navigate('/dashboard/client')
    } catch {
      // Error is handled by the store
    }
  }, [storeForceLogin, navigate])

  const startImpersonation = useCallback(
    async (userId: number) => {
      await storeStartImpersonation(userId)
      navigate('/dashboard/client')
    },
    [storeStartImpersonation, navigate]
  )

  const exitImpersonation = useCallback(async () => {
    await storeExitImpersonation()
  }, [storeExitImpersonation])

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    errorState,
    lockoutMinutes,
    // Impersonation state
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    // Methods
    login,
    logout,
    forceLogin,
    checkAuth,
    clearError,
    startImpersonation,
    exitImpersonation,
  }
}

export default useAuth
