/**
 * useUserDepartment Hook
 *
 * Fetches the department name for a user via a lightweight endpoint
 * that resolves user → role → department in one call.
 * Accessible to any authenticated user (no admin permission required).
 */

import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'

export function useUserDepartment(userId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-department', userId],
    queryFn: () => usersApi.getUserDepartment(userId),
    enabled: userId > 0,
    staleTime: 5 * 60_000,
  })

  return {
    data: data?.department_name ?? null,
    departmentName: data?.department_name ?? null,
    groupName: data?.group_name ?? null,
    isLoading,
  }
}
