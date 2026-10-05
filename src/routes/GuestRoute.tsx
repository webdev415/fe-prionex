import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { SessionRestoreModal } from '@/features/auth/components/SessionRestoreModal'
import { useConsumeSnapshot, useStoredTabs } from '@/features/auth/hooks/useStoredTabs'
import { safeReturnUrl } from '@/features/auth/utils/safeReturnUrl'
import { getAccessToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

interface GuestRouteProps {
  children: React.ReactNode
}

/**
 * GuestRoute - Only accessible by unauthenticated users.
 *
 * KAN-601: Redirects authenticated users to the page they were on
 * before logout/session-expiry (returnUrl) or to /dashboard as a
 * default. Falls back to ``location.state.from`` (older React Router
 * "remember where I came from" pattern).
 *
 * KAN-585: After login, fetches the user's last-session tab snapshot.
 * If non-empty AND the user hasn't dismissed the prompt this render,
 * shows the SessionRestoreModal (Q6 lock — always shown when stored
 * tabs exist, regardless of returnUrl). Restore opens URLs 2..N as new
 * tabs and navigates the current tab to URL 1. Start Fresh consumes the
 * snapshot and falls through to KAN-601's navigation (returnUrl or
 * /dashboard).
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // Check both store state AND token existence (for page refresh scenarios).
  const hasToken = !!getAccessToken()
  const isAuthed = isAuthenticated || hasToken

  // KAN-585: capture auth state at the FIRST render of this GuestRoute
  // mount. If the user landed here ALREADY holding a JWT (e.g. Tab B
  // opens to a /dashboard URL → ProtectedRoute bounces through /login
  // briefly → GuestRoute mounts here while localStorage still has the
  // token), `wasAuthedOnMount` is true. In that case the user did NOT
  // just log in — they were already authenticated when this tab
  // started. The modal should NOT appear.
  //
  // A real "fresh login" is the transition unauthenticated → authenticated
  // within this tab's lifetime: the user arrived without a token, typed
  // credentials, and the store flipped. That's when `wasAuthedOnMount`
  // is false but `isAuthed` is true → `isFreshLogin` is true → modal shows.
  //
  // Lazy useState initializer captures the value once at mount; it
  // intentionally never updates afterwards.
  const [wasAuthedOnMount] = useState(() => !!getAccessToken())
  const isFreshLogin = isAuthed && !wasAuthedOnMount

  // KAN-585: only fetch the snapshot when this is a fresh login AND not
  // in the mustChangePassword flow (useAuth handles that separately and
  // navigates to /change-password). Skipping the fetch on non-fresh
  // renders also avoids unnecessary BE calls on Tab B bounce.
  const shouldFetchTabs = isFreshLogin && !user?.mustChangePassword
  const { data: tabs, isLoading } = useStoredTabs({ enabled: shouldFetchTabs })
  const consume = useConsumeSnapshot()
  const [modalDismissed, setModalDismissed] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  if (!isAuthed) return <>{children}</>

  // KAN-601's destination logic.
  const computeDestination = (): string => {
    const rawReturn = new URLSearchParams(location.search).get('returnUrl')
    if (rawReturn) return safeReturnUrl(rawReturn)
    const fromLocation = (
      location.state as {
        from?: { pathname: string; search?: string; hash?: string }
      } | null
    )?.from
    if (fromLocation) {
      // Filtered like returnUrl: ProtectedRoute records the page it bounced
      // from, and that can be /change-password, where a user whose password
      // is already changed must not be sent back after signing in.
      return safeReturnUrl(
        `${fromLocation.pathname}${fromLocation.search ?? ''}${fromLocation.hash ?? ''}`
      )
    }
    return '/dashboard'
  }

  // Not a fresh login (Tab B bounce, pasted /login URL while already
  // authenticated, etc.) → skip the modal entirely and fall through to
  // KAN-601's navigation. shouldFetchTabs was false, so no BE call was
  // made and `tabs` will be undefined.
  if (!isFreshLogin) {
    return <Navigate to={computeDestination()} replace />
  }

  // Wait briefly for the stored-tabs fetch. Rendering null prevents a
  // flash of the wrong destination if the modal IS about to appear.
  if (isLoading) return null

  // No tabs OR user already chose Start Fresh → KAN-601 navigation.
  if (!tabs?.urls?.length || modalDismissed) {
    return <Navigate to={computeDestination()} replace />
  }

  // KAN-585: fresh login + stored tabs exist → show the modal (Q6 lock).
  return (
    <SessionRestoreModal
      count={tabs.count}
      isExecuting={isRestoring || consume.isPending}
      onRestore={async () => {
        setIsRestoring(true)
        // Q5 lock: open URLs 2..N as new tabs FIRST. We do this BEFORE
        // the snapshot DELETE so a network glitch doesn't prevent the
        // tabs from opening.
        for (let i = 1; i < tabs.urls.length; i++) {
          window.open(tabs.urls[i], '_blank')
        }
        // Consume the snapshot — best effort; if it fails (e.g. Redis
        // down), the modal won't appear again on next login until the
        // hash naturally expires (5d TTL).
        try {
          await consume.mutateAsync()
        } catch {
          /* swallow */
        }
        // Q5 / Q11 lock: navigate current tab to URL 1 via
        // window.location.assign so lazy-loaded route chunks load
        // fresh. (React Router navigate() would try to look up the
        // route in the current Router instance, which works but causes
        // a flicker; the hard reload is simpler and matches the
        // "session resumed" feel.)
        window.location.assign(tabs.urls[0])
      }}
      onStartFresh={async () => {
        try {
          await consume.mutateAsync()
        } catch {
          /* swallow */
        }
        // Re-render falls through to <Navigate to={computeDestination()} />
        // which honors KAN-601's returnUrl logic per Q6.
        setModalDismissed(true)
      }}
    />
  )
}

export default GuestRoute
