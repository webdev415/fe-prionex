import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/features/auth/api/authApi'
import { mapBackendUserToUser } from '@/lib/mapBackendUser'
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
          const updatedUser = mapBackendUserToUser(response.data)

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
