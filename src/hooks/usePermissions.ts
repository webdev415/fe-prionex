import { useAuthStore } from '@/stores/authStore'
import type { Permission } from '@/constants/permissions'

/**
 * Hook to check if the current user has a specific permission
 *
 * @param permission - The permission to check (e.g., PERMISSIONS.USERS.CREATE)
 * @returns true if user has the permission, false otherwise
 *
 * @example
 * ```tsx
 * const canCreateUsers = useHasPermission(PERMISSIONS.USERS.CREATE)
 *
 * if (canCreateUsers) {
 *   return <Button>Create User</Button>
 * }
 * ```
 */
export function useHasPermission(permission: Permission): boolean {
  const user = useAuthStore((state) => state.user)

  if (!user || !user.permissions) {
    return false
  }

  return user.permissions.includes(permission)
}

/**
 * Hook to check if the current user has ANY of the specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has at least one of the permissions, false otherwise
 *
 * @example
 * ```tsx
 * const canAccessUsers = useHasAnyPermission([
 *   PERMISSIONS.USERS.VIEW,
 *   PERMISSIONS.USERS.CREATE,
 *   PERMISSIONS.USERS.EDIT,
 * ])
 *
 * if (canAccessUsers) {
 *   return <Link to="/users">Users</Link>
 * }
 * ```
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const user = useAuthStore((state) => state.user)

  if (!user || !user.permissions || permissions.length === 0) {
    return false
  }

  return permissions.some((permission) => user.permissions!.includes(permission))
}

/**
 * Hook to check if the current user has ALL of the specified permissions
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has all of the permissions, false otherwise
 *
 * @example
 * ```tsx
 * const canFullyManageUsers = useHasAllPermissions([
 *   PERMISSIONS.USERS.VIEW,
 *   PERMISSIONS.USERS.CREATE,
 *   PERMISSIONS.USERS.EDIT,
 *   PERMISSIONS.USERS.DELETE,
 * ])
 *
 * if (canFullyManageUsers) {
 *   return <AdminPanel />
 * }
 * ```
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
  const user = useAuthStore((state) => state.user)

  if (!user || !user.permissions || permissions.length === 0) {
    return false
  }

  return permissions.every((permission) => user.permissions!.includes(permission))
}

/**
 * Hook to get the current user's role name
 *
 * @returns The user's active role name or null if not authenticated
 *
 * @example
 * ```tsx
 * const roleName = useUserRole()
 *
 * return <p>Your role: {roleName || 'No role assigned'}</p>
 * ```
 */
export function useUserRole(): string | null {
  const user = useAuthStore((state) => state.user)
  return user?.active_role_name || null
}

/**
 * Hook to get all of the current user's permissions
 *
 * @returns Array of permission strings or empty array if not authenticated
 *
 * @example
 * ```tsx
 * const permissions = useUserPermissions()
 *
 * return (
 *   <ul>
 *     {permissions.map(permission => (
 *       <li key={permission}>{permission}</li>
 *     ))}
 *   </ul>
 * )
 * ```
 */
export function useUserPermissions(): Permission[] {
  const user = useAuthStore((state) => state.user)
  return (user?.permissions as Permission[]) || []
}

/**
 * Hook to check if the current user is in impersonation mode
 *
 * @returns true if user is being impersonated, false otherwise
 *
 * @example
 * ```tsx
 * const isImpersonating = useIsImpersonating()
 *
 * if (isImpersonating) {
 *   return <ImpersonationBanner />
 * }
 * ```
 */
export function useIsImpersonating(): boolean {
  const isImpersonating = useAuthStore((state) => state.isImpersonating)
  return isImpersonating
}
