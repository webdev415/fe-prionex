import { describe, expect, it } from 'vitest'
import { previousWorkingDayWindow } from '../previousWorkingDayWindow'

/**
 * All SEVEN weekdays, individually — not "Monday and one other day".
 *
 * The rule has exactly one special case and three ways to get it wrong that
 * all render plausibly: special-casing the wrong weekday number (Python's
 * `weekday() == 0` is Monday, JavaScript's `getUTCDay() === 0` is Sunday),
 * generalising the weekend so Saturday and Sunday get widened windows of their
 * own, and letting "today" into the window. Each of those is invisible on most
 * days of the week, so the whole week is pinned.
 *
 * The anchor week below is real: 2026-09-14 is a Monday.
 */
describe('previousWorkingDayWindow', () => {
  it('gives MONDAY the three-day Friday–Sunday window — the weekend is not lost', () => {
    // The whole reason the rule exists. A copy that defaulted to "yesterday"
    // here would show the empty Sunday and drop two days of promises without
    // changing anything else on the page.
    expect(previousWorkingDayWindow('2026-09-14')).toEqual({
      dateFrom: '2026-09-11', // Friday
      dateTo: '2026-09-13', // Sunday
    })
  })

  it.each([
    ['Tuesday', '2026-09-15', '2026-09-14'],
    ['Wednesday', '2026-09-16', '2026-09-15'],
    ['Thursday', '2026-09-17', '2026-09-16'],
    ['Friday', '2026-09-18', '2026-09-17'],
    // Left LITERAL on purpose: the source specification special-cases Monday
    // alone, so Saturday looks back at Friday...
    ['Saturday', '2026-09-19', '2026-09-18'],
    // ...and Sunday at Saturday, rather than either of them widening.
    ['Sunday', '2026-09-20', '2026-09-19'],
  ])('gives %s the single previous day', (_weekday, today, yesterday) => {
    expect(previousWorkingDayWindow(today)).toEqual({
      dateFrom: yesterday,
      dateTo: yesterday,
    })
  })

  it('never includes today, on any day of the week', () => {
    // The sharpest difference from every sibling feed on this page, all of
    // which default to a window ending today — so a `fallbackFrom: today`
    // copied from a neighbour is the likeliest regression there is.
    for (const today of [
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]) {
      const window = previousWorkingDayWindow(today)
      expect(window).not.toBeNull()
      expect(window?.dateTo).not.toBe(today)
      expect(window?.dateFrom).not.toBe(today)
      expect(window?.dateTo.localeCompare(today)).toBeLessThan(0)
    }
  })

  it('distinguishes Monday from Sunday — the weekday numbering trap', () => {
    // Python's `weekday() == 0` is Monday; JavaScript's `getUTCDay() === 0` is
    // Sunday. A port that kept the literal 0 would widen SUNDAY's window and
    // leave Monday on the empty Sunday. Both halves are asserted here in one
    // place so the trap is named, not merely covered.
    expect(previousWorkingDayWindow('2026-09-14')?.dateFrom).toBe('2026-09-11') // Mon
    expect(previousWorkingDayWindow('2026-09-20')?.dateFrom).toBe('2026-09-19') // Sun
  })

  it('crosses a month boundary without drifting a day', () => {
    // 2026-11-02 is a Monday, so the window reaches back into October.
    expect(previousWorkingDayWindow('2026-11-02')).toEqual({
      dateFrom: '2026-10-30',
      dateTo: '2026-11-01',
    })
  })

  it('crosses a year boundary and a leap day without drifting', () => {
    // 2027-01-01 is a Friday: the window is 2026-12-31.
    expect(previousWorkingDayWindow('2027-01-01')).toEqual({
      dateFrom: '2026-12-31',
      dateTo: '2026-12-31',
    })
    // 2028-03-01 is a Wednesday and 2028 is a leap year — yesterday is the
    // 29th, which a naive "subtract one from the day number" would miss.
    expect(previousWorkingDayWindow('2028-03-01')).toEqual({
      dateFrom: '2028-02-29',
      dateTo: '2028-02-29',
    })
  })

  it.each([
    ['an impossible day', '2026-02-31'],
    ['a shape that is not a calendar day', '14.09.2026'],
    ['an empty string', ''],
    ['a datetime rather than a day', '2026-09-14T00:00:00Z'],
  ])('answers null for %s rather than inventing a window', (_case, input) => {
    // The honest answer: the caller then has no default to fill an absent
    // bound with, which surfaces as a blocked request instead of as a wrong
    // window quietly standing in for a real one.
    expect(previousWorkingDayWindow(input)).toBeNull()
  })

  it('is indifferent to the host timezone', () => {
    // The suite runs under a pinned UTC host (vitest.config.ts), so this does
    // not prove much by itself — what it pins is the SHAPE: the function takes
    // and returns bare calendar days and never instantiates a local Date, so
    // the answer cannot depend on where the machine is. A regression to
    // `new Date(today)` plus local getters would show up here the moment the
    // pinned zone moved.
    expect(previousWorkingDayWindow('2026-09-14')?.dateTo).toBe('2026-09-13')
  })
})
