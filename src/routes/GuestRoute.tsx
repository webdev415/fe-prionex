import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getAccessToken } from '@/lib/api'
import { safeReturnUrl } from '@/features/auth/utils/safeReturnUrl'

interface GuestRouteProps {
  children: React.ReactNode
}

/**
 * GuestRoute - Only accessible by unauthenticated users.
 * Redirects to dashboard (or previous location) if user is already logged in.
 *
 * Honors a ``?returnUrl=…`` query param on the login URL so operators who
 * were forced to /login by manual logout / session expiry get returned to
 * the page they were on. Falls back to ``location.state.from`` (the older
 * React Router "remember where I came from" pattern) and then to /dashboard.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Check both store state AND token existence (for page refresh scenarios)
  const hasToken = !!getAccessToken()

  // If authenticated or has valid token, redirect to dashboard.
  // Preserve the original search + hash so shareable URLs (e.g. Action
  // Analysis `?call_id=…`) survive a stale-token round-trip.
  if (isAuthenticated || hasToken) {
    // 1. Honor explicit ``?returnUrl=…`` first — this is the post-logout /
    //    post-session-expiry capture, sanitized to block open-redirects.
    const rawReturn = new URLSearchParams(location.search).get('returnUrl')
    if (rawReturn) {
      return <Navigate to={safeReturnUrl(rawReturn)} replace />
    }

    // 2. Otherwise fall back to React Router's "from" state (older pattern).
    const fromLocation = (
      location.state as {
        from?: { pathname: string; search?: string; hash?: string }
      }
    )?.from
    const fromPath = fromLocation
      ? `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}`
      : '/dashboard'
    return <Navigate to={fromPath} replace />
  }

  return <>{children}</>
}

export default GuestRoute
