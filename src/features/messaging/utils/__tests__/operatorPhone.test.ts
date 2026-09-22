import { describe, expect, it } from 'vitest'
import { resolveOperatorPhone } from '../operatorPhone'

describe('the phone an operator is reachable on', () => {
  it('uses the profile phone when there is one', () => {
    expect(resolveOperatorPhone({ phone: '380501234567' })).toBe('380501234567')
  })

  it('falls back to the extension, which a call-centre operator has instead', () => {
    expect(resolveOperatorPhone({ phone: '', asterisk_extension: '1004' })).toBe('ext. 1004')
    expect(resolveOperatorPhone({ asterisk_extension: '1004' })).toBe('ext. 1004')
  })

  it('prefers the phone when both exist', () => {
    expect(resolveOperatorPhone({ phone: '380501234567', asterisk_extension: '1004' })).toBe(
      '380501234567'
    )
  })

  it('ignores a phone that is only whitespace', () => {
    expect(resolveOperatorPhone({ phone: '   ', asterisk_extension: '1004' })).toBe('ext. 1004')
  })

  it('returns nothing when the operator has neither', () => {
    expect(resolveOperatorPhone({})).toBe('')
    expect(resolveOperatorPhone(null)).toBe('')
  })
})
