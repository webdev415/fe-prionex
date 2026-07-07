import { describe, expect, it } from 'vitest'
import { formatLegalDueMonthDay, legalDueDateToIso, parseLegalDueDate } from '../legalDueDate'

describe('legalDueDate', () => {
  it('serializes picked calendar day at local noon without shifting the date', () => {
    const picked = new Date(2026, 6, 11, 0, 0, 0, 0)
    const iso = legalDueDateToIso(picked)
    const parsed = parseLegalDueDate(iso)

    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(6)
    expect(parsed?.getDate()).toBe(11)
    expect(formatLegalDueMonthDay(iso)).toBe('07/11')
  })

  it('parses stored ISO using local calendar day', () => {
    const iso = legalDueDateToIso(new Date(2026, 6, 10, 0, 0, 0, 0))
    expect(formatLegalDueMonthDay(iso)).toBe('07/10')
  })
})
