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

// Every fixture above carries a Z. The task service does not send one: due_date
// is a naive DateTime column serialised with .isoformat(), so the wire value is
// UTC with no designator. That is the whole of KAN-1000 — the tests passed
// because they were fed a shape the API never produces.
describe('legalDueDate (offset-less wire values)', () => {
  it('reads a naive wire value as UTC, not browser local', () => {
    expect(parseLegalDueDate('2026-08-14T03:00:00')?.toISOString()).toBe('2026-08-14T03:00:00.000Z')
  })

  it('round-trips the deadline from the ticket', () => {
    const picked = new Date(2026, 7, 14, 6, 0, 0, 0)
    const sent = legalDueDateToIso(picked, KYIV)
    expect(sent).toBe('2026-08-14T03:00:00.000Z')

    const stored = '2026-08-14T03:00:00'
    expect(formatLegalDueDateTime(stored, KYIV, 'uk')).toBe('14.08 06:00')
  })

  it('keeps microseconds and the space separator readable', () => {
    expect(parseLegalDueDate('2026-08-14T03:00:00.123456')?.toISOString()).toBe(
      '2026-08-14T03:00:00.123Z'
    )
    expect(parseLegalDueDate('2026-08-14 03:00:00')?.toISOString()).toBe('2026-08-14T03:00:00.000Z')
  })

  it('leaves a value that already carries an offset alone', () => {
    expect(parseLegalDueDate('2026-08-14T03:00:00Z')?.toISOString()).toBe(
      '2026-08-14T03:00:00.000Z'
    )
    expect(parseLegalDueDate('2026-08-14T06:00:00+03:00')?.toISOString()).toBe(
      '2026-08-14T03:00:00.000Z'
    )
  })

  it('leaves a date-only value alone', () => {
    expect(parseLegalDueDate('2026-08-14')?.toISOString()).toBe('2026-08-14T00:00:00.000Z')
  })

  it('returns null for a blank or unparseable value', () => {
    expect(parseLegalDueDate('   ')).toBeNull()
    expect(parseLegalDueDate('not a date')).toBeNull()
  })

  // The three hours only move the calendar day for late-evening deadlines, so
  // this is where the old behaviour put a card in the wrong column.
  it('routes a late-evening deadline by the right calendar day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T09:00:00Z'))
    const stored = '2026-08-13T22:00:00'
    expect(formatLegalDueDateTime(stored, KYIV, 'uk')).toBe('14.08 01:00')
    expect(isLegalDueDateOverdue(stored, KYIV)).toBe(false)
    vi.useRealTimers()
  })
})
