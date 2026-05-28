import type { QueryClient } from '@tanstack/react-query'

type CallEventData = {
  client_id?: unknown
  clientId?: unknown
  [key: string]: unknown
}

export function getClientIdFromCallEventData(data: CallEventData | undefined): number | null {
  const rawClientId = data?.client_id ?? data?.clientId
  const clientId =
    typeof rawClientId === 'number'
      ? rawClientId
      : typeof rawClientId === 'string'
        ? Number(rawClientId)
        : NaN

  return Number.isInteger(clientId) && clientId > 0 ? clientId : null
}

export function invalidateCallRelatedQueries(queryClient: QueryClient, clientId?: number | null) {
  queryClient.invalidateQueries({ queryKey: ['callHistory'], exact: false })

  if (clientId) {
    queryClient.invalidateQueries({
      queryKey: ['clients', 'detail', clientId, 'callSmsHistory'],
    })
  }
}
