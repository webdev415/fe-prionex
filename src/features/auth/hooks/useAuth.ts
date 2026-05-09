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
    // 2FA challenge state
    twoFactorToken,
    twoFactorUsername,
    // Impersonation state
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    // Methods
    login: storeLogin,
    logout: storeLogout,
    forceLogin: storeForceLogin,
    verifyTwoFactor: storeVerifyTwoFactor,
    cancelTwoFactor: storeCancelTwoFactor,
    checkAuth,
    refreshUser,
    updateCurrentUser,
    clearError,
    startImpersonation: storeStartImpersonation,
    exitImpersonation: storeExitImpersonation,
  } = useAuthStore()

  const navigateAfterLogin = useCallback(() => {
    const currentUser = useAuthStore.getState().user
    if (currentUser?.mustChangePassword) {
      navigate('/change-password')
    } else {
      navigate('/dashboard')
    }
  }, [navigate])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        await storeLogin(credentials)
        // If 2FA was triggered the store stays in TWO_FACTOR_REQUIRED state and
        // there's no user yet — the page will render TwoFactorCodeCard instead.
        const stateAfter = useAuthStore.getState()
        if (stateAfter.isAuthenticated) {
          navigateAfterLogin()
        }
      } catch {
        // Error is handled by the store
      }
    },
    [storeLogin, navigateAfterLogin]
  )

  const logout = useCallback(async () => {
    await storeLogout()
    queryClient.clear()
    navigate('/login')
  }, [storeLogout, queryClient, navigate])

  const forceLogin = useCallback(async () => {
    try {
      await storeForceLogin()
      const stateAfter = useAuthStore.getState()
      if (stateAfter.isAuthenticated) {
        navigateAfterLogin()
      }
    } catch {
      // Error is handled by the store
    }
  }, [storeForceLogin, navigateAfterLogin])

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      try {
        await storeVerifyTwoFactor(code)
        navigateAfterLogin()
      } catch {
        // Error is handled by the store
      }
    },
    [storeVerifyTwoFactor, navigateAfterLogin]
  )

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
    // 2FA challenge state
    twoFactorToken,
    twoFactorUsername,
    // Impersonation state
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    // Methods
    login,
    logout,
    forceLogin,
    verifyTwoFactor,
    cancelTwoFactor: storeCancelTwoFactor,
    checkAuth,
    refreshUser,
    updateCurrentUser,
    clearError,
    startImpersonation,
    exitImpersonation,
  }
}

export default useAuth
