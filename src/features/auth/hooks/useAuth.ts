import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { buildLoginUrlWithReturn } from '@/features/auth/utils/safeReturnUrl'
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
      return
    }
    // For the normal case, GuestRoute (wrapping /login) handles the
    // redirect once it observes isAuthenticated=true. It reads
    // ?returnUrl=... from the URL and routes there. We deliberately do
    // NOT navigate here: GuestRoute renders synchronously during the
    // same React commit, so a navigate() call here would race against
    // (and typically override) GuestRoute's decision — but by then
    // GuestRoute has already stripped ?returnUrl from the URL, so we'd
    // fall back to /dashboard and lose the returnUrl entirely.
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
    const loginUrl = buildLoginUrlWithReturn()
    await storeLogout()
    queryClient.clear()
    navigate(loginUrl)
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
