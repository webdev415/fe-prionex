import { describe, expect, it } from 'vitest'
import { monogramInitials } from '../avatarMonogram'

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
