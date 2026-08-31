import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useIncludedClients } from '../useIncludedClients'
import type { CallMatchedClient } from '../../components/CallClientContracts'

const client = (clientId: number): CallMatchedClient => ({
  clientId,
  clientName: `Client ${clientId}`,
  contracts: [],
})

const clients = [client(1), client(2), client(3)]

describe('useIncludedClients', () => {
  it('includes every matched client to begin with', () => {
    const { result } = renderHook(() => useIncludedClients(clients))

    // An operator who touches nothing should still file the interaction against
    // everyone the number belongs to.
    expect(result.current.includedClientIds).toEqual([1, 2, 3])
  })

  it('drops the ones switched off, keeping the rest', () => {
    const { result } = renderHook(() => useIncludedClients(clients))

    act(() => result.current.setIncluded(2, false))

    expect(result.current.includedClientIds).toEqual([1, 3])
    expect(result.current.isIncluded(2)).toBe(false)
  })

  it('takes a client back once switched on again', () => {
    const { result } = renderHook(() => useIncludedClients(clients))

    act(() => result.current.setIncluded(2, false))
    act(() => result.current.setIncluded(2, true))

    expect(result.current.includedClientIds).toEqual([1, 2, 3])
  })

  it('includes a client that arrives after the window opened', () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: CallMatchedClient[] }) => useIncludedClients(list),
      { initialProps: { list: [client(1)] } }
    )
    act(() => result.current.setIncluded(1, false))

    rerender({ list: [client(1), client(4)] })

    // The screen-pop is enriched after the window opens, so a late arrival must
    // not be silently left out of the interaction.
    expect(result.current.includedClientIds).toEqual([4])
  })

  it('can end up with nobody selected', () => {
    const { result } = renderHook(() => useIncludedClients(clients))

    act(() => {
      result.current.setIncluded(1, false)
      result.current.setIncluded(2, false)
      result.current.setIncluded(3, false)
    })

    // Saving with nobody selected has to be prevented by the caller — there is
    // nowhere to write the interaction.
    expect(result.current.includedClientIds).toEqual([])
  })
})
