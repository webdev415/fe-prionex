import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getAccessToken } from '@/lib/api'

interface GuestRouteProps {
  children: React.ReactNode
}

/**
 * GuestRoute - Only accessible by unauthenticated users.
 * Redirects to dashboard (or previous location) if user is already logged in.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Check both store state AND token existence (for page refresh scenarios)
  const hasToken = !!getAccessToken()

  // If authenticated or has valid token, redirect to dashboard
  if (isAuthenticated || hasToken) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}

export default GuestRoute
