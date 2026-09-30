import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks'
import { PermissionRoute } from './PermissionRoute'

/**
 * The home choice at /dashboard (story 17-56, Р-9). The clients list still needs
 * `view_clients`. A role without it but with the right to read credit
 * applications (the credit roles) is sent to the applications list instead of
 * the 403 page — the target route admits exactly that right, so the redirect
 * never lands on a 403. `replace` keeps "Back" from bouncing into the redirect
 * again (Р-10). Anyone else keeps the 403 page, as before.
 */
export function DashboardHomeRoute({ children }: { children: ReactNode }) {
  const canReadCreditApplications = useHasPermission(PERMISSIONS.CREDIT.APPLICATIONS_VIEW)
  const creditHome = canReadCreditApplications ? (
    <Navigate to="/dashboard/credit/applications" replace />
  ) : undefined

  return (
    <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW} fallback={creditHome}>
      {children}
    </PermissionRoute>
  )
}
