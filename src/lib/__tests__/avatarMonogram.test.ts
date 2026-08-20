import { describe, expect, it } from 'vitest'
import { MONOGRAM_PALETTE, monogramInitials, monogramSwatch } from '../avatarMonogram'

describe('monogramInitials', () => {
  it('takes the first letter of each name', () => {
    expect(monogramInitials('Olena', 'Kovalchuk')).toBe('OK')
  })

  it('uppercases regardless of how the name was entered', () => {
    expect(monogramInitials('olena', 'kovalchuk')).toBe('OK')
  })

  it('handles non-latin names', () => {
    expect(monogramInitials('Олена', 'Ковальчук')).toBe('ОК')
  })

  it('copes with a missing surname', () => {
    expect(monogramInitials('Olena', null)).toBe('O')
  })

  it('ignores leading whitespace rather than rendering a blank', () => {
    expect(monogramInitials('  Olena', '  Kovalchuk')).toBe('OK')
  })

  it('falls back to two words of the fallback', () => {
    expect(monogramInitials(null, null, 'Olena Kovalchuk')).toBe('OK')
  })

  it('falls back to the first two letters of a single token', () => {
    expect(monogramInitials(null, null, 'admin')).toBe('AD')
  })

  it('returns nothing when there is nothing to show', () => {
    expect(monogramInitials(null, null)).toBe('')
    expect(monogramInitials('', '', '   ')).toBe('')
  })
})

describe('monogramSwatch', () => {
  it('gives the same id the same colour every time', () => {
    expect(monogramSwatch(42)).toBe(monogramSwatch(42))
  })

  it('spreads different ids across the palette', () => {
    const seen = new Set(
      Array.from({ length: MONOGRAM_PALETTE.length }, (_, i) => monogramSwatch(i).background)
    )
    expect(seen.size).toBe(MONOGRAM_PALETTE.length)
  })

  it('never falls off the end of the palette', () => {
    for (const id of [0, 1, 7, 8, 999999, -3]) {
      expect(MONOGRAM_PALETTE).toContain(monogramSwatch(id))
    }
  })

  it('is stable for a large id', () => {
    expect(monogramSwatch(1_000_003)).toBe(monogramSwatch(1_000_003))
  })

  it('degrades to the first swatch for a missing id', () => {
    expect(monogramSwatch(null)).toBe(MONOGRAM_PALETTE[0])
    expect(monogramSwatch(undefined)).toBe(MONOGRAM_PALETTE[0])
    expect(monogramSwatch(Number.NaN)).toBe(MONOGRAM_PALETTE[0])
  })
})
