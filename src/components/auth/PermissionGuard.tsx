import type { ReactNode } from 'react'
import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from '@/hooks'
import type { Permission } from '@/constants/permissions'

interface PermissionGuardProps {
  children: ReactNode
  /**
   * Single required permission
   */
  permission?: Permission
  /**
   * Multiple required permissions with mode
   */
  permissions?: Permission[]
  /**
   * Mode for checking multiple permissions
   * - 'any': User needs at least one of the permissions (OR logic)
   * - 'all': User needs all of the permissions (AND logic)
   * @default 'all'
   */
  mode?: 'any' | 'all'
  /**
   * Custom fallback component to render if user lacks permission
   * If not provided, renders nothing (hides the children)
   */
  fallback?: ReactNode
}

/**
 * Component wrapper that conditionally renders children based on user permissions
 *
 * Use this for hiding/showing UI elements (buttons, links, sections) based on RBAC.
 * Does NOT redirect - simply hides content if user lacks permission.
 *
 * @example Single permission
 * ```tsx
 * <PermissionGuard permission={PERMISSIONS.USERS.CREATE}>
 *   <Button>Create User</Button>
 * </PermissionGuard>
 * ```
 *
 * @example Multiple permissions with ANY mode
 * ```tsx
 * <PermissionGuard
 *   permissions={[PERMISSIONS.USERS.EDIT, PERMISSIONS.USERS.DELETE]}
 *   mode="any"
 * >
 *   <Button>Manage Users</Button>
 * </PermissionGuard>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <PermissionGuard
 *   permission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}
 *   fallback={<p className="text-gray-500">Ask your admin for access</p>}
 * >
 *   <ReportsPanel />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  mode = 'all',
  fallback = null,
}: PermissionGuardProps) {
  // Check single permission
  const hasSinglePermission = useHasPermission(permission!)

  // Check multiple permissions
  const hasAnyPermission = useHasAnyPermission(permissions || [])
  const hasAllPermissions = useHasAllPermissions(permissions || [])

  // Determine if user has access
  let hasAccess = false

  if (permission) {
    // Single permission check
    hasAccess = hasSinglePermission
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    if (mode === 'any') {
      hasAccess = hasAnyPermission
    } else {
      hasAccess = hasAllPermissions
    }
  } else {
    // No permissions specified - allow access
    hasAccess = true
  }

  // User lacks required permissions
  if (!hasAccess) {
    return <>{fallback}</>
  }

  // User has required permissions - render children
  return <>{children}</>
}

export default PermissionGuard
