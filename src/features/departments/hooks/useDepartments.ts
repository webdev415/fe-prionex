/**
 * useDepartments Hook
 *
 * React Query hook for fetching paginated departments list.
 */

import { useQuery } from '@tanstack/react-query'
import { departmentsApi } from '../api/departmentsApi'
import type { DepartmentFilters } from '../types'

/**
 * Query key factory for departments
 */
export const departmentsKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentsKeys.all, 'list'] as const,
  list: (filters: DepartmentFilters) => [...departmentsKeys.lists(), filters] as const,
  details: () => [...departmentsKeys.all, 'detail'] as const,
  detail: (id: number) => [...departmentsKeys.details(), id] as const,
}

/**
 * Hook to fetch departments list
 */
export function useDepartments(filters: DepartmentFilters = {}) {
  return useQuery({
    queryKey: departmentsKeys.list(filters),
    queryFn: () => departmentsApi.getDepartments(filters),
  })
}

/**
 * Hook to fetch a single department by ID
 */
export function useDepartment(id: number) {
  return useQuery({
    queryKey: departmentsKeys.detail(id),
    queryFn: () => departmentsApi.getDepartment(id),
    enabled: !!id && id > 0,
  })
}
