import { useQuery } from '@tanstack/react-query'
import { activityLogApi, type ActivityLogFilters } from '@/features/clients/api/activityLogApi'

/**
 * The merged per-client activity feed.
 *
 * `enabled` gates on both the permission and the tab being open — the endpoint
 * fans out to three services, so it should not run for a tab nobody looked at.
 */
/**
 * The cache key, exported so the tab can read page one's entry back.
 *
 * Only page one carries the merged total -- the expensive half of that count
 * is skipped on later pages, where it cannot have changed -- so the tab looks
 * the first page up rather than keeping a second copy of the number.
 */
export function activityLogQueryKey(clientId: number | null, filters: ActivityLogFilters) {
  return ['client-activity-log', clientId, filters] as const
}

export function useClientActivityLog(
  clientId: number | null,
  filters: ActivityLogFilters,
  enabled: boolean
) {
  return useQuery({
    queryKey: activityLogQueryKey(clientId, filters),
    queryFn: () => activityLogApi.get(clientId!, filters),
    enabled: enabled && clientId !== null,
    staleTime: 0,
    // Page one's entry is what later pages read their total from, so it has to
    // outlive a long look at a deep page. The default collection window is
    // five minutes, which an operator can easily exceed.
    gcTime: 30 * 60_000,
  })
}
