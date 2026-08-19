/**
 * KAN-973 §4 — the pre-selection against the shapes the app actually produces.
 *
 * The unit tests next door build records by hand, which is how this shipped
 * broken: they used `customer_number`, the client card passed the *display*
 * mapping where that field is renamed to `phone`, and every record silently
 * failed the guard. A fully-optional interface let TypeScript agree.
 *
 * These tests use the real `CallRecord` shape returned by the API, and assert
 * the mapped shape is now rejected by the compiler rather than at runtime.
 */
import { describe, expect, it } from 'vitest'
import { resolveRecentCallPhone } from '../recentCallPhone'
import type { CallRecord } from '@/features/clients/api/types'

/** A record as `GET /api/v1/calls/client/{id}` returns it. */
function apiCall(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    call_id: 'c1',
    client_id: 100,
    agent_extension: '2099',
    customer_number: '+380501234567',
    state: 'ended',
    initiated_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    ended_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    ...overrides,
  }
}

const PHONES = [
  { number: '050 123 45 67', contactTypeId: 1 },
  { number: '+380991112233', contactTypeId: 2 },
]

describe('resolveRecentCallPhone against the API shape', () => {
  it('finds the number of a call that just ended', () => {
    const picked = resolveRecentCallPhone({
      calls: [apiCall()],
      phones: PHONES,
      nowMs: Date.now(),
    })
    // Matched across formatting: the switchboard reports +380501234567, the
    // client record stores "050 123 45 67".
    expect(picked?.number).toBe('050 123 45 67')
  })

  it('ignores a call that ended outside the window', () => {
    const picked = resolveRecentCallPhone({
      calls: [apiCall({ ended_at: new Date(Date.now() - 11 * 60_000).toISOString() })],
      phones: PHONES,
      nowMs: Date.now(),
    })
    expect(picked).toBeNull()
  })

  it('ignores a call still in progress', () => {
    const picked = resolveRecentCallPhone({
      calls: [apiCall({ ended_at: null })],
      phones: PHONES,
      nowMs: Date.now(),
    })
    expect(picked).toBeNull()
  })

  it('takes the most recently ended call, not the most recently started', () => {
    const picked = resolveRecentCallPhone({
      calls: [
        apiCall({
          call_id: 'long',
          customer_number: '+380501234567',
          ended_at: new Date(Date.now() - 1 * 60_000).toISOString(),
        }),
        apiCall({
          call_id: 'short',
          customer_number: '+380991112233',
          ended_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        }),
      ],
      phones: PHONES,
      nowMs: Date.now(),
    })
    expect(picked?.number).toBe('050 123 45 67')
  })

  it('rejects the display-mapped shape at compile time', () => {
    // This is the bug, encoded. The client card's mapped record renames
    // customer_number to phone; passing it must not type-check. If this ever
    // compiles without the expect-error, the guard has been weakened again.
    const mapped = [{ phone: '+380501234567', ended_at: new Date().toISOString() }]
    // @ts-expect-error mapped records have `phone`, not `customer_number`
    resolveRecentCallPhone({ calls: mapped, phones: PHONES, nowMs: Date.now() })
  })
})
