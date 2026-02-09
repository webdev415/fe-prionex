/**
 * useUserDepartment Hook
 *
 * Fetches the department name for a user based on their role assignment in the current project.
 * Returns the department name, 'Archived' if department is archived, 'Unknown' if not found, or null if still loading.
 */

import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import { useRole } from '@/features/roles/hooks/useRole'
import { useDepartment } from '@/features/departments/hooks/useDepartments'
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

  // Fetch the role details which includes department_id
  const { data: role } = useRole(roleId || 0)

  // Fetch the department details if department_id exists
  const { data: department } = useDepartment(role?.department_id || 0)

  // Determine what to show
  let departmentDisplay: string | null = null

  if (role?.department_id && department) {
    // If department exists and is not active (archived), show "Archived"
    if (department.is_active === false) {
      departmentDisplay = 'Archived'
    } else {
      // Otherwise show the department name
      departmentDisplay = department.name
    }
  } else if (role?.department_id && !department) {
    // Department ID exists but couldn't fetch department (might be loading)
    departmentDisplay = null
  }

  // Return the department display value
  return {
    data: departmentDisplay,
    isLoading: !user || (!!roleId && !role) || (!!role?.department_id && !department),
  }
}
