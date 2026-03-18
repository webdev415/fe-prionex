import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from '@/hooks'
import type { Permission } from '@/constants/permissions'
import { ForbiddenPage } from '@/pages/Forbidden'

interface PermissionRouteProps {
  children: React.ReactNode
  /**
   * Single required permission
   */
  requiredPermission?: Permission
  /**
   * Multiple required permissions with mode
   */
  requiredPermissions?: Permission[]
  /**
   * Mode for checking multiple permissions
   * - 'any': User needs at least one of the permissions (OR logic)
   * - 'all': User needs all of the permissions (AND logic)
   * @default 'all'
   */
  mode?: 'any' | 'all'
  /**
   * Custom fallback component to render if user lacks permission
   * If not provided, shows the 403 Forbidden page
   */
  fallback?: React.ReactNode
}

/**
 * Route wrapper that checks if user has required permissions
 *
 * Shows a 403 Forbidden page if user lacks required permissions.
 * Use this for protecting entire routes based on RBAC.
 *
 * @example Single permission
 * ```tsx
 * <Route
 *   path="/users"
 *   element={
 *     <PermissionRoute requiredPermission={PERMISSIONS.USERS.VIEW}>
 *       <UsersPage />
 *     </PermissionRoute>
 *   }
 * />
 * ```
 *
 * @example Multiple permissions with ANY mode
 * ```tsx
 * <Route
 *   path="/clients"
 *   element={
 *     <PermissionRoute
 *       requiredPermissions={[PERMISSIONS.CLIENTS.VIEW, PERMISSIONS.CLIENTS.EDIT]}
 *       mode="any"
 *     >
 *       <ClientsPage />
 *     </PermissionRoute>
 *   }
 * />
 * ```
 *
 * @example Multiple permissions with ALL mode
 * ```tsx
 * <Route
 *   path="/admin"
 *   element={
 *     <PermissionRoute
 *       requiredPermissions={[PERMISSIONS.USERS.CREATE, PERMISSIONS.USERS.DELETE]}
 *       mode="all"
 *     >
 *       <AdminPanel />
 *     </PermissionRoute>
 *   }
 * />
 * ```
 */
export function PermissionRoute({
  children,
  requiredPermission,
  requiredPermissions,
  mode = 'all',
  fallback,
}: PermissionRouteProps) {
  // Check single permission
  const hasSinglePermission = useHasPermission(requiredPermission!)

  // Check multiple permissions
  const hasAnyPermission = useHasAnyPermission(requiredPermissions || [])
  const hasAllPermissions = useHasAllPermissions(requiredPermissions || [])

  // Determine if user has access
  let hasAccess = false

  if (requiredPermission) {
    // Single permission check
    hasAccess = hasSinglePermission
  } else if (requiredPermissions && requiredPermissions.length > 0) {
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
    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback}</>
    }

    // Otherwise show 403 Forbidden page
    return <ForbiddenPage />
  }

  // User has required permissions - render children
  return <>{children}</>
}

export default PermissionRoute
