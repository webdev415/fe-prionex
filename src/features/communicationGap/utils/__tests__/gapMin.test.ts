import { describe, it, expect } from 'vitest'
import { GAP_MIN_CEILING, parseGapMin } from '../gapMin'

describe('parseGapMin', () => {
  it('treats an absent or empty value as "no minimum"', () => {
    const none = { value: undefined, isInvalid: false, isTooLarge: false }
    expect(parseGapMin(null)).toEqual(none)
    expect(parseGapMin(undefined)).toEqual(none)
    expect(parseGapMin('')).toEqual(none)
    expect(parseGapMin('   ')).toEqual(none)
  })

  it('keeps 0 as a real value, not as "no minimum"', () => {
    // The backend's own floor is `ge=0`, so "0" is a value the operator can
    // type and the tab must send — any falsy handling would drop it on the way
    // to the wire and quietly turn it into "filter absent".
    expect(parseGapMin('0')).toEqual({ value: 0, isInvalid: false, isTooLarge: false })
  })

  it('accepts non-negative integers up to the backend ceiling', () => {
    // 10 is the production p90 (probe 2026-08-17) — the realistic input.
    expect(parseGapMin('10')).toEqual({ value: 10, isInvalid: false, isTooLarge: false })
    expect(parseGapMin(String(GAP_MIN_CEILING))).toEqual({
      value: GAP_MIN_CEILING,
      isInvalid: false,
      isTooLarge: false,
    })
  })

  it.each(['-1', '1.5', '1e3', 'abc', ' 2', '2 ', '+2', '0x2'])(
    'rejects %s (the backend would answer 422) as malformed, not as too large',
    (raw) => {
      expect(parseGapMin(raw)).toEqual({ value: undefined, isInvalid: true, isTooLarge: false })
    }
  )

  it('rejects a value above the int32 ceiling as the DISTINCT "too large" refusal', () => {
    // 2147483648 IS "a whole number of 0 or more" — the malformed-value hint
    // would describe everything except the actual violation, hence the flag
    // that lets the tab pick the ceiling sentence.
    const tooLarge = { value: undefined, isInvalid: true, isTooLarge: true }
    expect(parseGapMin(String(GAP_MIN_CEILING + 1))).toEqual(tooLarge)
    // Digits so long they leave the safe-integer range are the same refusal.
    expect(parseGapMin('99999999999999999999')).toEqual(tooLarge)
  })
})
