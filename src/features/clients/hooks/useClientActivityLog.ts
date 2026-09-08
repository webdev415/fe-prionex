import { useQuery } from '@tanstack/react-query'
import { activityLogApi, type ActivityLogFilters } from '@/features/clients/api/activityLogApi'

/**
 * The merged per-client activity feed.
 *
 * `enabled` gates on both the permission and the tab being open — the endpoint
 * fans out to three services, so it should not run for a tab nobody looked at.
 */
export function useClientActivityLog(
  clientId: number | null,
  filters: ActivityLogFilters,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['client-activity-log', clientId, filters],
    queryFn: () => activityLogApi.get(clientId!, filters),
    enabled: enabled && clientId !== null,
    staleTime: 0,
  })
}
