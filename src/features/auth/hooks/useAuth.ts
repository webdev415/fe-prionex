import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import type { LoginRequest } from '@/types/api'

export function useAuth() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    refreshUser,
    updateCurrentUser,
    clearError,
    startImpersonation: storeStartImpersonation,
    exitImpersonation: storeExitImpersonation,
  } = useAuthStore()

  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        await storeLogin(credentials)
        const currentUser = useAuthStore.getState().user
        if (currentUser?.mustChangePassword) {
          navigate('/change-password')
        } else {
          navigate('/dashboard')
        }
      } catch {
        // Error is handled by the store
      }
    },
    [storeLogin, navigate]
  )

  const logout = useCallback(async () => {
    await storeLogout()
    queryClient.clear()
    navigate('/login')
  }, [storeLogout, queryClient, navigate])

  const forceLogin = useCallback(async () => {
    try {
      await storeForceLogin()
      const currentUser = useAuthStore.getState().user
      if (currentUser?.mustChangePassword) {
        navigate('/change-password')
      } else {
        navigate('/dashboard')
      }
    } catch {
      // Error is handled by the store
    }
  }, [storeForceLogin, navigate])

  const startImpersonation = useCallback(
    async (userId: number) => {
      await storeStartImpersonation(userId)
      navigate('/dashboard')
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
    refreshUser,
    updateCurrentUser,
    clearError,
    startImpersonation,
    exitImpersonation,
  }
}

export default useAuth
