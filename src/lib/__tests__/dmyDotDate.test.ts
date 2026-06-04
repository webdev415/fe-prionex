import { describe, it, expect } from 'vitest'
import {
  formatDateAsDmyDot,
  maskDmyDotFromDigits,
  parseDmyDotToDate,
  validateDmyDotInput,
} from '../dmyDotDate'

describe('dmyDotDate', () => {
  it('formats date as DD.MM.YYYY', () => {
    expect(formatDateAsDmyDot(new Date(2026, 4, 31))).toBe('31.05.2026')
  })

  it('masks digits with auto-inserted dots', () => {
    expect(maskDmyDotFromDigits('')).toBe('')
    expect(maskDmyDotFromDigits('01')).toBe('01')
    expect(maskDmyDotFromDigits('0106')).toBe('01.06')
    expect(maskDmyDotFromDigits('01062026')).toBe('01.06.2026')
    expect(maskDmyDotFromDigits('010620261234')).toBe('01.06.2026')
  })

  it('parses valid dates', () => {
    const d = parseDmyDotToDate('31.05.2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(4)
    expect(d!.getDate()).toBe(31)
  })

  it('rejects invalid calendar dates', () => {
    expect(parseDmyDotToDate('35.13.2026')).toBeNull()
    expect(parseDmyDotToDate('31.02.2026')).toBeNull()
    expect(parseDmyDotToDate('01.06')).toBeNull()
  })

  it('validates input states', () => {
    expect(validateDmyDotInput('').status).toBe('empty')
    expect(validateDmyDotInput('01.06').status).toBe('incomplete')
    expect(validateDmyDotInput('35.13.2026').status).toBe('invalid')
    expect(validateDmyDotInput('31.05.2026').status).toBe('valid')
  })

  it('enforces min/max range', () => {
    const min = new Date(2026, 0, 10)
    const max = new Date(2026, 0, 20)
    expect(validateDmyDotInput('05.01.2026', min, max).status).toBe('outOfRange')
    expect(validateDmyDotInput('25.01.2026', min, max).status).toBe('outOfRange')
    expect(validateDmyDotInput('15.01.2026', min, max).status).toBe('valid')
  })
})
