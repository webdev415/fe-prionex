import { describe, it, expect } from 'vitest'
import { GAP_MIN_CEILING, parseGapMin } from '../gapMin'

describe('parseGapMin', () => {
  it('treats an absent or empty value as "no minimum"', () => {
    expect(parseGapMin(null)).toEqual({ value: undefined, isInvalid: false })
    expect(parseGapMin(undefined)).toEqual({ value: undefined, isInvalid: false })
    expect(parseGapMin('')).toEqual({ value: undefined, isInvalid: false })
    expect(parseGapMin('   ')).toEqual({ value: undefined, isInvalid: false })
  })

  it('keeps 0 as a real value, not as "no minimum"', () => {
    // The backend's own floor is `ge=0`, so "0" is a value the operator can
    // type and the tab must send — any falsy handling would drop it on the way
    // to the wire and quietly turn it into "filter absent".
    expect(parseGapMin('0')).toEqual({ value: 0, isInvalid: false })
  })

  it('accepts non-negative integers up to the backend ceiling', () => {
    // 10 is the production p90 (probe 2026-08-17) — the realistic input.
    expect(parseGapMin('10')).toEqual({ value: 10, isInvalid: false })
    expect(parseGapMin(String(GAP_MIN_CEILING))).toEqual({
      value: GAP_MIN_CEILING,
      isInvalid: false,
    })
  })

  it.each(['-1', '1.5', '1e3', 'abc', ' 2', '2 ', '+2', '0x2'])(
    'rejects %s (the backend would answer 422)',
    (raw) => {
      expect(parseGapMin(raw)).toEqual({ value: undefined, isInvalid: true })
    }
  )

  it('rejects a value above the int32 ceiling the backend enforces', () => {
    expect(parseGapMin(String(GAP_MIN_CEILING + 1))).toEqual({
      value: undefined,
      isInvalid: true,
    })
  })
})
