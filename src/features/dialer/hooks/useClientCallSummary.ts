import { useQuery } from '@tanstack/react-query'

import { dialerService } from '../api/dialerService'
import type { ClientCallSummary } from '../types'

export const clientCallSummaryKeys = {
  all: ['dialerClientCallSummary'] as const,
  detail: (clientId: number) => [...clientCallSummaryKeys.all, clientId] as const,
}

export function useClientCallSummary(clientId: number, enabled = true) {
  return useQuery<ClientCallSummary>({
    queryKey: clientCallSummaryKeys.detail(clientId),
    queryFn: () => dialerService.getClientCallSummary(clientId),
    enabled: enabled && Number.isFinite(clientId) && clientId > 0,
    staleTime: 30 * 1000,
  })
}
