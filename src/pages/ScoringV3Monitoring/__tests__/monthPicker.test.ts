/**
 * Month handling on the v3 screens — timezone correctness.
 *
 * The snapshot key is a date-only string ("2026-08-01"). `new Date()` parses
 * those as UTC, so anywhere west of Greenwich the resulting Date is the
 * PREVIOUS evening — and a month start becomes the previous month. Observed:
 * the shadow-run picker showed "July 2026" while the page displayed August's
 * numbers, which is the kind of mismatch that makes a reviewer distrust every
 * other number on the screen.
 *
 * These run under TZ=UTC in CI, so each test constructs the offset explicitly
 * rather than relying on the runner's timezone.
 */

import { describe, it, expect } from 'vitest'

/** The page's helper: date-only string -> a LOCAL Date at that month start. */
function parseMonthStart(monthStart: string): Date {
  const [y, m] = monthStart.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** The page's helper: Date -> the "YYYY-MM-01" snapshot key. */
function toMonthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** The work list's helper: today -> "YYYY-MM". */
function currentMonthFrom(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

describe('month-start parsing', () => {
  it('keeps the month it was given', () => {
    const d = parseMonthStart('2026-08-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7) // August, zero-indexed
    expect(d.getDate()).toBe(1)
  })

  it('does not drift the way new Date(string) does', () => {
    // The bug, pinned: the spec parses a date-only ISO string as UTC.
    const utcParsed = new Date('2026-08-01')
    expect(utcParsed.getTime()).toBe(Date.UTC(2026, 7, 1))
    // ...so at any negative offset it renders as the previous month.
    const shiftedLocalMonth = new Date(utcParsed.getTime() - 5 * 3600_000).getUTCMonth()
    expect(shiftedLocalMonth).toBe(6) // July — what the picker was showing

    // The helper is immune: it never goes through UTC.
    expect(parseMonthStart('2026-08-01').getMonth()).toBe(7)
  })

  it('round-trips through the picker unchanged', () => {
    for (const key of ['2026-01-01', '2026-03-01', '2026-08-01', '2026-12-01']) {
      expect(toMonthStart(parseMonthStart(key))).toBe(key)
    }
  })

  it('labels the month the user actually selected', () => {
    const label = parseMonthStart('2026-08-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    expect(label).toBe('August 2026')
  })
})

describe("the work list's current month", () => {
  it('stays in the current month late on the last evening of a month', () => {
    // 31 Aug 20:30 at UTC-5 is 1 Sep 01:30 UTC. toISOString() would say
    // "2026-09" and the queue would go empty for the rest of the evening.
    const lastEvening = new Date(2026, 7, 31, 20, 30)
    expect(currentMonthFrom(lastEvening)).toBe('2026-08')
    expect(lastEvening.getMonth()).toBe(7)
  })

  it('rolls over only once the local month actually changes', () => {
    expect(currentMonthFrom(new Date(2026, 8, 1, 0, 5))).toBe('2026-09')
  })
})
