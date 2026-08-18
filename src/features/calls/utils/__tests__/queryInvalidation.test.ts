/**
 * What a finished call has to refresh.
 *
 * The recent-calls key was added for KAN-973 §4 and missed here, which meant
 * the query ran once on mount and never again — window-focus refetching is off
 * globally and there is no interval. In the ticket's own flow (take the call,
 * hang up, press the hotkey) the cache still predated the call, so the phone
 * pre-selection silently did nothing. The keys are spelled out in the util, so
 * this asserts they still match the factory that builds them.
 */
import { describe, expect, it, vi } from 'vitest'
import { invalidateCallRelatedQueries } from '../queryInvalidation'
import { clientKeys } from '@/features/clients/hooks/useClients'

function fakeClient() {
  const invalidateQueries = vi.fn()
  return { client: { invalidateQueries } as never, invalidateQueries }
}

function invalidatedKeys(fn: ReturnType<typeof vi.fn>) {
  return fn.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
}

describe('invalidateCallRelatedQueries', () => {
  it('refreshes the recent-calls query the hotkey pre-selection reads', () => {
    const { client, invalidateQueries } = fakeClient()
    invalidateCallRelatedQueries(client, 100)

    expect(invalidatedKeys(invalidateQueries)).toContain(
      JSON.stringify(clientKeys.recentCalls(100))
    )
  })

  it('still refreshes the call/SMS history and the global call history', () => {
    const { client, invalidateQueries } = fakeClient()
    invalidateCallRelatedQueries(client, 100)

    const keys = invalidatedKeys(invalidateQueries)
    expect(keys).toContain(JSON.stringify(clientKeys.callSmsHistory(100)))
    expect(keys).toContain(JSON.stringify(['callHistory']))
  })

  it('skips the per-client keys when the call has no client', () => {
    const { client, invalidateQueries } = fakeClient()
    invalidateCallRelatedQueries(client, null)

    expect(invalidatedKeys(invalidateQueries)).toEqual([JSON.stringify(['callHistory'])])
  })
})
