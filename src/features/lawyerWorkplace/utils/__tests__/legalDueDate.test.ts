import { describe, expect, it, vi } from 'vitest'
import {
  formatLegalDueMonthDay,
  isLegalDueDateOverdue,
  legalDueDateToIso,
  parseLegalDueDate,
} from '../legalDueDate'

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

  it('treats the due calendar day in Kyiv as not overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T10:00:00Z'))
    const due = legalDueDateToIso(new Date(2026, 6, 12))
    expect(isLegalDueDateOverdue(due)).toBe(false)
    vi.useRealTimers()
  })

  it('marks tasks overdue after the due calendar day in Kyiv', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T06:00:00Z'))
    const due = legalDueDateToIso(new Date(2026, 6, 12))
    expect(isLegalDueDateOverdue(due)).toBe(true)
    vi.useRealTimers()
  })
})
