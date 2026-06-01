/**
 * URL-state roundtrip tests for the Calls tab filter bar. Hand-edited URLs
 * with bad telephony_types values must be dropped silently (mirrors the
 * existing pattern for outcome_filter).
 */

import { describe, it, expect } from 'vitest'

import type { TelephonyType } from '@/features/training'

import {
  CALL_FILTERS_DEFAULT,
  readCallsUrlState,
  writeCallsUrlState,
  toCallMonitoringQuery,
} from '../callsUrlState'

describe('callsUrlState â€” telephony_types', () => {
  it('writes a comma-joined param when telephony_types is set', () => {
    const out = writeCallsUrlState(new URLSearchParams(), {
      ...CALL_FILTERS_DEFAULT,
      telephony_types: ['white', 'grey'],
    })
    expect(out.get('telephony_types')).toBe('white,grey')
  })

  it('omits the param entirely when telephony_types is undefined or empty', () => {
    const undef = writeCallsUrlState(new URLSearchParams(), {
      ...CALL_FILTERS_DEFAULT,
      telephony_types: undefined,
    })
    expect(undef.has('telephony_types')).toBe(false)

    const empty = writeCallsUrlState(new URLSearchParams(), {
      ...CALL_FILTERS_DEFAULT,
      telephony_types: [],
    })
    expect(empty.has('telephony_types')).toBe(false)
  })

  it('reads a comma-joined param back as a typed array', () => {
    const params = new URLSearchParams('telephony_types=white,grey')
    const state = readCallsUrlState(params)
    expect(state.telephony_types).toEqual(['white', 'grey'])
  })

  it('drops invalid values from a hand-edited URL', () => {
    const params = new URLSearchParams('telephony_types=white,blue,unknown')
    const state = readCallsUrlState(params)
    expect(state.telephony_types).toEqual(['white', 'unknown'])
  })

  it('returns undefined for an all-invalid telephony_types param', () => {
    const params = new URLSearchParams('telephony_types=blue,red')
    const state = readCallsUrlState(params)
    expect(state.telephony_types).toBeUndefined()
  })

  it('roundtrips through write â†’ read with all canonical values preserved', () => {
    const telephony_types: TelephonyType[] = ['white', 'grey', 'unknown']
    const original = { ...CALL_FILTERS_DEFAULT, telephony_types }
    const written = writeCallsUrlState(new URLSearchParams(), original)
    const readBack = readCallsUrlState(written)
    expect(readBack.telephony_types).toEqual(['white', 'grey', 'unknown'])
  })

  it('passes telephony_types through to the monitoring query', () => {
    const query = toCallMonitoringQuery({
      ...CALL_FILTERS_DEFAULT,
      telephony_types: ['grey'],
    })
    expect(query.telephony_types).toEqual(['grey'])
  })
})
