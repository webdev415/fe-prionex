import { describe, it, expect } from 'vitest'
import { MAX_VERIFIED_CEILING, parseMaxVerified } from '../maxVerified'

describe('parseMaxVerified', () => {
  it('treats an absent or empty value as "no cap"', () => {
    expect(parseMaxVerified(null)).toEqual({ value: undefined, isInvalid: false })
    expect(parseMaxVerified(undefined)).toEqual({ value: undefined, isInvalid: false })
    expect(parseMaxVerified('')).toEqual({ value: undefined, isInvalid: false })
    expect(parseMaxVerified('   ')).toEqual({ value: undefined, isInvalid: false })
  })

  it('keeps 0 as a real value, not as "no cap"', () => {
    // «Never verified since the purchase» is the most useful filter value —
    // any falsy handling would drop it on the way to the wire.
    expect(parseMaxVerified('0')).toEqual({ value: 0, isInvalid: false })
  })

  it('accepts non-negative integers up to the backend ceiling', () => {
    expect(parseMaxVerified('3')).toEqual({ value: 3, isInvalid: false })
    expect(parseMaxVerified(String(MAX_VERIFIED_CEILING))).toEqual({
      value: MAX_VERIFIED_CEILING,
      isInvalid: false,
    })
  })

  it.each(['-1', '1.5', '1e3', 'abc', ' 2', '2 ', '+2', '0x2'])(
    'rejects %s (the backend would answer 422)',
    (raw) => {
      expect(parseMaxVerified(raw)).toEqual({ value: undefined, isInvalid: true })
    }
  )

  it('rejects a value above the int32 ceiling the backend enforces', () => {
    expect(parseMaxVerified(String(MAX_VERIFIED_CEILING + 1))).toEqual({
      value: undefined,
      isInvalid: true,
    })
  })
})
