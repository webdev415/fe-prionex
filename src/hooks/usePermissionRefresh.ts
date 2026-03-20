import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/features/auth/api/authApi'
import { toast } from 'sonner'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

/**
 * Hook that periodically refreshes user permissions in the background
 *
 * Checks for permission changes every 5 minutes and updates the auth store.
 * If permissions change, shows a notification and reloads the page.
 *
 * This prevents users from seeing stale UI when their role/permissions are
 * changed by an administrator while they're logged in.
 *
 * @example
 * ```tsx
 * export function DashboardLayout({ children }: DashboardLayoutProps) {
 *   usePermissionRefresh() // Automatically refreshes every 5 minutes
 *
 *   return <div>{children}</div>
 * }
 * ```
 */
export function usePermissionRefresh() {
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    // Don't run if user is not logged in
    if (!user) return

    // Capture current user permissions at effect start
    const currentUserPermissions = user.permissions

    const interval = setInterval(async () => {
      try {
        // Fetch latest user data (includes fresh permissions)
        const response = await authApi.me()

        // Check if permissions changed
        const oldPermissions = currentUserPermissions?.sort().join(',')
        const newPermissions = response.data.permissions?.sort().join(',')

        if (oldPermissions !== newPermissions) {
          // Map backend user data to frontend User type
          const updatedUser = {
            id: String(response.data.id),
            username: response.data.username,
            email: response.data.email,
            firstName: response.data.first_name,
            lastName: response.data.last_name,
            projects:
              response.data.projects?.map((p: { id: number; name: string; role_name: string }) => ({
                id: String(p.id),
                name: p.name,
                roles: [{ id: String(p.id), name: p.role_name }],
              })) || [],
            active_project_id: response.data.active_project
              ? String(response.data.active_project.id)
              : null,
            active_role_id: response.data.role ? String(response.data.role.id) : null,
            active_role_name: response.data.role?.name || null,
            permissions: response.data.permissions || [],
            createdAt: response.data.created_at,
            updatedAt: response.data.created_at,
            timezone: response.data.timezone,
          }

          // Update user in auth store using Zustand's set method
          useAuthStore.setState({ user: updatedUser })

          // Show notification to user
          toast.info('Your permissions have been updated. Page will refresh.', {
            duration: 2000,
          })

          // Refresh page after 2 seconds to apply new permissions
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } catch (error) {
        // Don't show error to user - this is a background operation
        // Just log it for debugging
        console.error('Permission refresh failed:', error)
      }
    }, REFRESH_INTERVAL)

    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [user]) // Re-run if user changes (login/logout)
}
