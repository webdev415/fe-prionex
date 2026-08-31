/**
 * Route guard for pages that must not exist before the KAN-794 sign-off.
 *
 * KAN-791: "Hidden until sub-task 8 sign-off; toggled on per brand."
 *
 * Hiding the nav entry is not enough — the route stayed reachable by typing the
 * URL, so anyone holding `view_scoring_config` (Admin, Supervisor) could read
 * unvalidated v3 priorities during the shadow run. That is precisely what the
 * ticket forbids, and it would also let someone act on numbers the client has
 * not approved.
 *
 * Fails CLOSED: while the switch is still loading we render nothing rather than
 * flashing the page, and any brand without an explicit `v3_ui_enabled = true`
 * is redirected away.
 */

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useV3UiEnabledState } from '@/features/scoring/hooks/useV3Scores'

export function V3CutoverRoute({
  children,
  redirectTo = '/dashboard',
}: {
  children: ReactNode
  redirectTo?: string
}) {
  const { enabled, isLoading } = useV3UiEnabledState()

  // Never flash the page while the answer is in flight.
  if (isLoading) return null
  if (!enabled) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}
