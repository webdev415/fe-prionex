import { describe, expect, it } from 'vitest'
import { formatClientFullName } from '@/lib/formatters'

describe('formatClientFullName', () => {
  it('returns "Last First Middle" when all three are present', () => {
    expect(
      formatClientFullName({
        first_name: 'Олексій',
        middle_name: 'Михайлович',
        last_name: 'Іванов',
      })
    ).toBe('Іванов Олексій Михайлович')
  })

  it('returns "Last First" when middle is null (no trailing space)', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: null, last_name: 'Іванов' })
    ).toBe('Іванов Олексій')
  })

  it('returns "Last First" when middle is empty string', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: '', last_name: 'Іванов' })
    ).toBe('Іванов Олексій')
  })

  it('returns empty string when all fields are null', () => {
    expect(formatClientFullName({ first_name: null, middle_name: null, last_name: null })).toBe('')
  })

  it('returns empty string when all fields are undefined', () => {
    expect(formatClientFullName({})).toBe('')
  })

  it('returns "Last" only when first and middle are absent', () => {
    expect(formatClientFullName({ first_name: null, middle_name: null, last_name: 'Іванов' })).toBe(
      'Іванов'
    )
  })

  it('returns "First" only when last and middle are absent', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: null, last_name: null })
    ).toBe('Олексій')
  })

  it('skips missing first while keeping last and middle in correct slots', () => {
    expect(
      formatClientFullName({ first_name: null, middle_name: 'Михайлович', last_name: 'Іванов' })
    ).toBe('Іванов Михайлович')
  })
})
