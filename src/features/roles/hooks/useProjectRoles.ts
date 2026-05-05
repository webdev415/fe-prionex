/**
 * useProjectRoles Hook
 *
 * Fetches active roles for a single project. Use one instance per
 * selected project so React Query caches per-project results.
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import { rolesKeys } from './useRoles'

export function useProjectRoles(projectId: number | undefined) {
  const params = { project_id: projectId, is_active: true, page_size: 100 }
  return useQuery({
    queryKey: rolesKeys.list(params),
    queryFn: () => rolesApi.getRoles(params),
    enabled: projectId !== undefined,
  })
}
