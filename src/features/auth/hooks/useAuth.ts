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
    login: storeLogin,
    logout: storeLogout,
    forceLogin: storeForceLogin,
    checkAuth,
    clearError,
  } = useAuthStore()

  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        await storeLogin(credentials)
        navigate('/dashboard')
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
      navigate('/dashboard')
    } catch {
      // Error is handled by the store
    }
  }, [storeForceLogin, navigate])

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    errorState,
    lockoutMinutes,
    login,
    logout,
    forceLogin,
    checkAuth,
    clearError,
  }
}

export default useAuth
