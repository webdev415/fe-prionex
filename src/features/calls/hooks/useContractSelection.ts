import { useState } from 'react'

import type { CallContractGroupData } from '../components/CallContractGroup'

/**
 * Which contract the interaction will be filed against.
 *
 * A contract is required, so this never yields null while one is available: it
 * settles on the first contract of the first enabled group and only moves when
 * the operator picks another — or when the one they picked stops being
 * selectable, which happens if they switch that group off. Filing against a
 * contract the operator can no longer see would attach the interaction
 * somewhere they cannot check.
 *
 * Derived rather than synchronised: state holds only what the operator chose,
 * and the fallback is computed on read. An effect writing the fallback back
 * into state would cascade a render and could be saved against before it
 * caught up.
 */
export function useContractSelection(
  groups: CallContractGroupData[],
  enabledGroupIds: ReadonlySet<string>
) {
  const [chosenContractId, setSelectedContractId] = useState<string | null>(null)

  const selectable = groups
    .filter((group) => enabledGroupIds.has(group.id))
    .flatMap((group) => group.contracts.map((contract) => contract.id))

  // A choice that is selectable again — its group was switched back on — is
  // honoured rather than forgotten.
  const selectedContractId =
    chosenContractId !== null && selectable.includes(chosenContractId)
      ? chosenContractId
      : (selectable[0] ?? null)

  return { selectedContractId, setSelectedContractId }
}
