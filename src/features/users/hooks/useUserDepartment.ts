/**
 * useUserDepartment Hook
 *
 * Fetches the department name for a user based on their role assignment in the current project.
 * Returns the department name or null if not found.
 */

import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { useRole } from '@/features/roles/hooks/useRole'
import { useAuthStore } from '@/stores/authStore'

export function useUserDepartment(userId: number) {
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const currentProjectId = activeProjectId ? Number(activeProjectId) : null

  // First, fetch the user details to get their role assignments
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: userId > 0,
  })

  // Find the role_id for the current project from user.projects
  const roleId = user?.projects?.find((p) => p.project_id === currentProjectId)?.role_id

  // Fetch the role details which includes department_name
  const { data: role } = useRole(roleId || 0)

  // Return the department name from the role
  return {
    data: role?.department_name || null,
    isLoading: !user || (!!roleId && !role),
  }
}
