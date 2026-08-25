import { useState } from 'react'

import type { CallMatchedClient } from '../components/CallClientContracts'

/**
 * Which matched clients the interaction will be written to.
 *
 * Every matched client starts included — the operator switches off the ones
 * that should not receive it, rather than opting each one in. That way an
 * operator who never touches the toggles still files the interaction against
 * everyone the number belongs to, which is the common case.
 *
 * Tracks exclusions rather than inclusions so a client arriving late — the
 * screen-pop is enriched after the window opens — is included by default
 * instead of silently missing out.
 */
export function useIncludedClients(clients: CallMatchedClient[]) {
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set())

  const setIncluded = (clientId: number, included: boolean) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (included) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const includedClientIds = clients
    .map((client) => client.clientId)
    .filter((clientId) => !excluded.has(clientId))

  return {
    includedClientIds,
    isIncluded: (clientId: number) => !excluded.has(clientId),
    setIncluded,
  }
}
