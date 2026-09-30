import { Navigate } from 'react-router-dom'
import { useUbkiAvailable } from '@/features/ubki/hooks/useUbkiAvailable'

interface UbkiProjectRouteProps {
  children: React.ReactNode
}

/**
 * Opens the UBKI integration page only in a Ukrainian project (story 17-56,
 * Р-4). `UkrainianProjectRoute` folds every country except 'ES' into 'UA', so a
 * Canadian project could open this page by a direct address; this guard reads
 * the same check as every other UBKI gate. `UkrainianProjectRoute` stays as is:
 * it also guards the assistant and SMS templates.
 */
export function UbkiProjectRoute({ children }: UbkiProjectRouteProps) {
  if (!useUbkiAvailable()) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
