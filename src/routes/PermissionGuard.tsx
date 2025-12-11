import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth'

interface PermissionGuardProps {
  children: ReactNode
  requiredPermission: string
  fallbackPath?: string
}

/**
 * Permission Guard Component
 *
 * Wraps routes that require specific permissions.
 * Redirects to dashboard if user doesn't have the required permission.
 */
export function PermissionGuard({
  children,
  requiredPermission,
  fallbackPath = '/dashboard',
}: PermissionGuardProps) {
  const { user } = useAuth()

  // Check if user has the required permission
  const hasPermission = user?.permissions?.includes(requiredPermission) ?? false

  useEffect(() => {
    if (!hasPermission && user) {
      console.warn(
        `User ${user.username} (ID: ${user.id}) attempted to access route requiring permission: ${requiredPermission}`
      )
    }
  }, [hasPermission, user, requiredPermission])

  if (!hasPermission) {
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

export default PermissionGuard
