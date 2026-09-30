import { describe, expect, it } from 'vitest'
import {
  MAX_OPERATOR_ID,
  MAX_OPERATOR_IDS,
  formatOperatorIdsParam,
  readOperatorIdsParam,
} from '../operatorIdsParam'

describe('readOperatorIdsParam', () => {
  it('reads an absent or empty key as "no filter"', () => {
    expect(readOperatorIdsParam(null)).toEqual({ ids: [], error: null })
    expect(readOperatorIdsParam('')).toEqual({ ids: [], error: null })
    expect(readOperatorIdsParam('  ')).toEqual({ ids: [], error: null })
  })

  it('reads a comma-separated list, de-duplicated in first-seen order', () => {
    expect(readOperatorIdsParam('102,101,102')).toEqual({ ids: [102, 101], error: null })
  })

  it('mirrors the backend ceiling of 200 ids', () => {
    // The constant IS the contract (`USER_IDS_TOO_MANY`, params.max_ids = 200).
    expect(MAX_OPERATOR_IDS).toBe(200)
    const atCap = Array.from({ length: 200 }, (_, i) => i + 1)
    expect(readOperatorIdsParam(atCap.join(','))).toEqual({ ids: atCap, error: null })
    const overCap = [...atCap, 201]
    expect(readOperatorIdsParam(overCap.join(','))).toEqual({ ids: overCap, error: 'tooMany' })
  })

  it('counts the ceiling AFTER de-duplication — the backend de-duplicates too', () => {
    const repeated = Array.from({ length: 201 }, () => 7)
    expect(readOperatorIdsParam(repeated.join(','))).toEqual({ ids: [7], error: null })
  })

  it.each(['0', '-1', 'abc', '1.0', '+1', '1e3', '1,,2', '1,x'])(
    'refuses a token the backend would not read as an id (%s)',
    (raw) => {
      // A silent drop would send a DIFFERENT filter from the one the link
      // says; the reading is a verdict, and nothing is usable.
      expect(readOperatorIdsParam(raw)).toEqual({ ids: [], error: 'invalid' })
    }
  )

  it('mirrors the int32 range of an id', () => {
    expect(MAX_OPERATOR_ID).toBe(2_147_483_647)
    expect(readOperatorIdsParam('2147483647')).toEqual({ ids: [2_147_483_647], error: null })
    expect(readOperatorIdsParam('2147483648')).toEqual({ ids: [], error: 'invalid' })
  })
})

describe('formatOperatorIdsParam', () => {
  it('writes the list comma-separated and an empty selection as the ABSENCE of the key', () => {
    expect(formatOperatorIdsParam([101, 102])).toBe('101,102')
    expect(formatOperatorIdsParam([])).toBeNull()
  })

  it('round-trips through the reader', () => {
    const ids = [6274, 101, 102]
    expect(readOperatorIdsParam(formatOperatorIdsParam(ids))).toEqual({ ids, error: null })
  })
})
