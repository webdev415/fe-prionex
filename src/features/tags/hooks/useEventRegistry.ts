/**
 * useEventRegistry — read-only inventory of domain events from tag-service.
 *
 * Used by RuleFormModal to populate trigger event dropdown and to expose
 * payload field hints when building conditions. Cached aggressively because
 * the registry only changes when a new publisher is deployed.
 */

import { useQuery } from '@tanstack/react-query'
import { getEventRegistry, type EventRegistryResponse } from '../api/tagSettingsApi'

export const eventRegistryKeys = {
  all: ['tag-event-registry'] as const,
}

export function useEventRegistry() {
  return useQuery<EventRegistryResponse | null>({
    queryKey: eventRegistryKeys.all,
    queryFn: async () => {
      try {
        return await getEventRegistry()
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 404) return null
        throw err
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
