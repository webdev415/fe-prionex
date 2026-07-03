import { useQuery } from '@tanstack/react-query'
import { legalApi } from '../api/legalApi'
import { legalWorkplaceKeys } from './useLegalInbox'

/**
 * Fetch a client's contracts (debts) for the Letter-parameters contract picker.
 * Disabled until a valid client is selected.
 */
export function useLegalClientContracts(clientId: number | null, options?: { enabled?: boolean }) {
  const hasClient = clientId != null && clientId > 0
  const enabled = options?.enabled !== false && hasClient

  return useQuery({
    queryKey: [...legalWorkplaceKeys.all, 'client-contracts', clientId] as const,
    queryFn: () => legalApi.listClientContracts(clientId as number),
    enabled,
    staleTime: 60_000,
  })
}
