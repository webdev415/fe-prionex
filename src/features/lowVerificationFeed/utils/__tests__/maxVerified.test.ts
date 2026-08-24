import { describe, it, expect } from 'vitest'
import { MAX_VERIFIED_CEILING, parseMaxVerified } from '../maxVerified'

describe('parseMaxVerified', () => {
  it('treats an absent or empty value as "no cap"', () => {
    const none = { value: undefined, isInvalid: false, isTooLarge: false }
    expect(parseMaxVerified(null)).toEqual(none)
    expect(parseMaxVerified(undefined)).toEqual(none)
    expect(parseMaxVerified('')).toEqual(none)
    expect(parseMaxVerified('   ')).toEqual(none)
  })

  it('keeps 0 as a real value, not as "no cap"', () => {
    // «Never verified since the purchase» is the most useful filter value —
    // any falsy handling would drop it on the way to the wire.
    expect(parseMaxVerified('0')).toEqual({ value: 0, isInvalid: false, isTooLarge: false })
  })

  it('accepts non-negative integers up to the backend ceiling', () => {
    expect(parseMaxVerified('3')).toEqual({ value: 3, isInvalid: false, isTooLarge: false })
    expect(parseMaxVerified(String(MAX_VERIFIED_CEILING))).toEqual({
      value: MAX_VERIFIED_CEILING,
      isInvalid: false,
      isTooLarge: false,
    })
  })

  it.each(['-1', '1.5', '1e3', 'abc', ' 2', '2 ', '+2', '0x2'])(
    'rejects %s (the backend would answer 422) as malformed, not as too large',
    (raw) => {
      expect(parseMaxVerified(raw)).toEqual({
        value: undefined,
        isInvalid: true,
        isTooLarge: false,
      })
    }
  )

  it('rejects a value above the int32 ceiling as the DISTINCT "too large" refusal', () => {
    // 2147483648 IS "a whole number of 0 or more" — the malformed-value hint
    // would describe everything except the actual violation, hence the flag
    // that lets the tab pick the ceiling sentence. (Same split as the sibling
    // feed's parseGapMin.)
    const tooLarge = { value: undefined, isInvalid: true, isTooLarge: true }
    expect(parseMaxVerified(String(MAX_VERIFIED_CEILING + 1))).toEqual(tooLarge)
    // Digits so long they leave the safe-integer range are the same refusal.
    expect(parseMaxVerified('99999999999999999999')).toEqual(tooLarge)
  })
})
