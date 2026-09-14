import { describe, expect, it } from 'vitest'
import { MAX_RANGE_DAYS, isWindowTooLong } from '../window'

describe('promises feed window guard', () => {
  it('pins the mirrored backend cap at a 366-day difference', () => {
    // The constant IS the contract (reports.py: end - start <= 366) — a
    // "tidy-up" to 365 must be a conscious decision, not a refactor slip.
    expect(MAX_RANGE_DAYS).toBe(366)
  })

  it('lets the widest allowed window — exactly a 366-day difference — through', () => {
    // 2026-01-01 → 2027-01-02 differ by 366 days (367 inclusive): the last
    // window the backend still answers. Pinning the boundary from the allowed
    // side too, or the guard could silently tighten.
    expect(isWindowTooLong('2026-01-01', '2027-01-02')).toBe(false)
  })

  it('refuses a 367-day difference', () => {
    expect(isWindowTooLong('2026-01-01', '2027-01-03')).toBe(true)
  })

  it('treats a same-day window as trivially fine', () => {
    // The tab's DEFAULT window (today–today) goes down this path on every
    // mount.
    expect(isWindowTooLong('2026-09-08', '2026-09-08')).toBe(false)
  })

  it('crosses a leap February without drifting a day', () => {
    // 2028 is a leap year: 2027-03-01 → 2028-03-01 is exactly a 366-day
    // difference (the leap day is inside), so it is still allowed — while the
    // same pair over a common year (365 days) obviously is too. Date.parse
    // reads both bounds as UTC midnights, so the difference is exact whatever
    // the host timezone is.
    expect(isWindowTooLong('2027-03-01', '2028-03-01')).toBe(false)
    expect(isWindowTooLong('2027-03-01', '2028-03-02')).toBe(true)
  })

  it('does not report an inverted pair as too long — that is the inversion guard’s finding', () => {
    expect(isWindowTooLong('2027-01-01', '2026-01-01')).toBe(false)
  })
})
