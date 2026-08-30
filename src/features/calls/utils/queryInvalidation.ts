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
    // KAN-973 §4 — the hotkey phone pre-selection asks "did a call to this
    // client just end?", and a call ending is the only thing that changes the
    // answer. Without this the query fetched once on mount and never again:
    // window-focus refetching is off globally and there is no interval, so in
    // the ticket's own flow — take the call, hang up, press the hotkey — the
    // cache still predated the call and the pre-selection silently did nothing.
    //
    // Keys are spelled out rather than imported from `clientKeys` to match the
    // line above; this file is a leaf util and pulling in the clients hooks
    // module for two strings would be a poor trade.
    queryClient.invalidateQueries({
      queryKey: ['clients', 'detail', clientId, 'recentCalls'],
    })
  }
}
