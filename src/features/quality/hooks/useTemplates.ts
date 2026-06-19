import { useQuery } from '@tanstack/react-query'
import { listTemplates } from '../api/qualityService'

export const templateKeys = {
  all: ['quality', 'templates'] as const,
  list: (includeArchived: boolean) => [...templateKeys.all, 'list', includeArchived] as const,
  detail: (templateId: number) => [...templateKeys.all, 'detail', templateId] as const,
}

export function useTemplates(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: templateKeys.list(includeArchived),
    queryFn: () => listTemplates(includeArchived),
    enabled,
    // Templates change rarely (KAN-412 admin path). Long stale to keep the
    // side-panel picker snappy and reduce GETs on every modal open.
    staleTime: 5 * 60_000,
  })
}
