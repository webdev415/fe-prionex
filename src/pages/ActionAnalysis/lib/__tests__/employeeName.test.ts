import { describe, it, expect } from 'vitest'
import { formatEmployeeName } from '../employeeName'

describe('formatEmployeeName', () => {
  it('renders "Last First (SIP)" when the operator is found', () => {
    expect(formatEmployeeName({ first_name: 'Ivan', last_name: 'Ivanov' }, '1023')).toBe(
      'Ivanov Ivan (1023)'
    )
  })

  it('falls back to "— (SIP)" when the operator is not found', () => {
    expect(formatEmployeeName(undefined, '1023')).toBe('— (1023)')
  })

  it('falls back to "— (SIP)" when both name parts are blank', () => {
    expect(formatEmployeeName({ first_name: '', last_name: '' }, '1023')).toBe('— (1023)')
  })

  it('renders a partial name without a stray space', () => {
    expect(formatEmployeeName({ first_name: '', last_name: 'Ivanov' }, '1023')).toBe(
      'Ivanov (1023)'
    )
  })
})
