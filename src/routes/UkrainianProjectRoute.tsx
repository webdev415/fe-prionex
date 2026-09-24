import { Navigate } from 'react-router-dom'
import { useProjectCountry } from '@/hooks/useProjectCountry'

interface UkrainianProjectRouteProps {
  children: React.ReactNode
}

export function UkrainianProjectRoute({ children }: UkrainianProjectRouteProps) {
  if (useProjectCountry() !== 'UA') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
