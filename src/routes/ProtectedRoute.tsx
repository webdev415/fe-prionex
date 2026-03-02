import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Icons } from '@/lib/icons'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const checkAuth = useAuthStore((state) => state.checkAuth)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Only check auth once on mount
    if (!hasCheckedRef.current && !isAuthenticated && !isLoading) {
      hasCheckedRef.current = true
      checkAuth()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - only run once on mount

  if (isLoading) {
    return (
      <div className="bg-dark-500 flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Force password change redirect
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
