import { describe, expect, it, vi } from 'vitest'
import {
  formatLegalDueDateTime,
  formatLegalDueMonthDay,
  isLegalDueDateOverdue,
  legalDueDateToIso,
  parseLegalDueDate,
} from '../legalDueDate'

const KYIV = 'Europe/Kyiv'

describe('legalDueDate', () => {
  it('serializes picked date+time in profile timezone without shifting the day', () => {
    const picked = new Date(2026, 6, 11, 9, 30, 0, 0)
    const iso = legalDueDateToIso(picked, KYIV)
    const parsed = parseLegalDueDate(iso)

    expect(parsed).not.toBeNull()
    // No language → defaults to en-US ordering (MM/DD).
    expect(formatLegalDueMonthDay(iso, KYIV)).toBe('07/11')
    expect(formatLegalDueDateTime(iso, KYIV)).toBe('07/11 09:30')
    // uk reorders to DD.MM while keeping the profile-TZ calendar day + time.
    expect(formatLegalDueMonthDay(iso, KYIV, 'uk')).toBe('11.07')
    expect(formatLegalDueDateTime(iso, KYIV, 'uk')).toBe('11.07 09:30')
  })

  it('parses stored ISO using profile calendar day', () => {
    const iso = legalDueDateToIso(new Date(2026, 6, 10, 14, 0, 0, 0), KYIV)
    expect(formatLegalDueMonthDay(iso, KYIV)).toBe('07/10')
  })

  it('treats the due calendar day in profile TZ as not overdue', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T10:00:00Z'))
    const due = legalDueDateToIso(new Date(2026, 6, 12, 9, 0, 0, 0), KYIV)
    expect(isLegalDueDateOverdue(due, KYIV)).toBe(false)
    vi.useRealTimers()
  })

  it('marks tasks overdue after the due calendar day in profile TZ', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T06:00:00Z'))
    const due = legalDueDateToIso(new Date(2026, 6, 12, 9, 0, 0, 0), KYIV)
    expect(isLegalDueDateOverdue(due, KYIV)).toBe(true)
    vi.useRealTimers()
  })

  it('uses profile timezone not browser local for overdue checks', () => {
    vi.useFakeTimers()
    // 2026-07-13 01:00 UTC = still Jul 12 evening in America/New_York
    vi.setSystemTime(new Date('2026-07-13T01:00:00Z'))
    const due = '2026-07-12T16:00:00.000Z' // noon America/New_York on Jul 12
    expect(isLegalDueDateOverdue(due, 'America/New_York')).toBe(false)
    expect(isLegalDueDateOverdue(due, 'Europe/Kyiv')).toBe(true)
    vi.useRealTimers()
  })
})
