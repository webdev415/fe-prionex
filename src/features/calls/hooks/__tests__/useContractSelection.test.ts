import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useContractSelection } from '../useContractSelection'
import type { CallContractGroupData } from '../../components/CallContractGroup'

function contract(id: string) {
  return {
    id,
    number: `№${id}`,
    status: 'Open',
    counterparty: 'Bank X',
    loanPrincipal: 1,
    debt: 1,
    saleDate: null,
    lastContact: null,
  }
}

const groups: CallContractGroupData[] = [
  { id: 'own', contracts: [contract('a'), contract('b')] },
  { id: 'third', thirdPartyName: 'Ivanov', contracts: [contract('c')] },
]

const all: ReadonlySet<string> = new Set(['own', 'third'])

describe('useContractSelection', () => {
  it('starts on the first contract rather than nothing', () => {
    const { result } = renderHook(() => useContractSelection(groups, all))

    // A contract is required, so there is never a state where the operator has
    // filled the form and cannot save because nothing is picked.
    expect(result.current.selectedContractId).toBe('a')
  })

  it('keeps the choice the operator made', () => {
    const { result } = renderHook(() => useContractSelection(groups, all))

    act(() => result.current.setSelectedContractId('c'))

    expect(result.current.selectedContractId).toBe('c')
  })

  it('moves off a contract whose group was switched off', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: ReadonlySet<string> }) => useContractSelection(groups, enabled),
      { initialProps: { enabled: all } }
    )
    act(() => result.current.setSelectedContractId('c'))

    rerender({ enabled: new Set(['own']) })

    // Filing against a contract the operator can no longer see would attach the
    // interaction somewhere they cannot check.
    expect(result.current.selectedContractId).toBe('a')
  })

  it('yields nothing when no group is selectable', () => {
    const { result } = renderHook(() => useContractSelection(groups, new Set<string>()))

    expect(result.current.selectedContractId).toBeNull()
  })

  it('yields nothing for a caller with no contracts at all', () => {
    const { result } = renderHook(() => useContractSelection([], all))

    // The unknown-contact case: the interaction is filed with no contract.
    expect(result.current.selectedContractId).toBeNull()
  })
})

describe('useContractSelection — restoring a choice', () => {
  it('honours the original choice when its group comes back', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: ReadonlySet<string> }) => useContractSelection(groups, enabled),
      { initialProps: { enabled: all } }
    )
    act(() => result.current.setSelectedContractId('c'))

    rerender({ enabled: new Set(['own']) })
    expect(result.current.selectedContractId).toBe('a')

    rerender({ enabled: all })

    // Forgetting it would make the toggle destructive rather than a filter.
    expect(result.current.selectedContractId).toBe('c')
  })
})
