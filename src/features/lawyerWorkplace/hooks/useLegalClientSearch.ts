import { useQuery } from '@tanstack/react-query'
import { legalApi } from '../api/legalApi'
import { legalWorkplaceKeys } from './useLegalInbox'

export function useLegalClientSearch(query: string, options?: { enabled?: boolean }) {
  const trimmed = query.trim()
  const enabled = options?.enabled !== false && trimmed.length >= 2

  return useQuery({
    queryKey: [...legalWorkplaceKeys.all, 'client-search', trimmed] as const,
    queryFn: () => legalApi.searchClients(trimmed),
    enabled,
    staleTime: 30_000,
  })
}
