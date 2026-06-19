import { useQuery } from '@tanstack/react-query'
import { listInteractionChannels } from '../api/actionAnalysisService'

export const interactionChannelsKeys = {
  all: ['action-analysis', 'interaction-channels'] as const,
}

/**
 * Distinct `interactions.channel` values for the active project. Cached for
 * 5 minutes — the list grows slowly and is fine to share across all
 * Interaction History sub-tab mounts.
 */
export function useInteractionChannels(enabled = true) {
  return useQuery({
    queryKey: interactionChannelsKeys.all,
    queryFn: () => listInteractionChannels(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
