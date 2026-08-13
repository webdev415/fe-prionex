import { describe, it, expect } from 'vitest'
import { currentMonthRange } from '../monthRange'

describe('currentMonthRange', () => {
  it('returns the first and last day of the month in the given timezone', () => {
    // 2026-05-17T12:00Z is 2026-05-17 everywhere relevant
    const range = currentMonthRange('Europe/Kyiv', new Date('2026-05-17T12:00:00Z'))
    expect(range).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it.each([
    ['30-day month', '2026-04-17T12:00:00Z', '2026-04-01', '2026-04-30'],
    ['non-leap February', '2026-02-17T12:00:00Z', '2026-02-01', '2026-02-28'],
    ['leap February', '2028-02-17T12:00:00Z', '2028-02-01', '2028-02-29'],
    ['December', '2026-12-17T12:00:00Z', '2026-12-01', '2026-12-31'],
  ])('handles %s', (_case, iso, from, to) => {
    expect(currentMonthRange('UTC', new Date(iso))).toEqual({ from, to })
  })

  it('resolves the month in the profile timezone, not the browser one', () => {
    // 23:30 UTC on the last day of April is already 01:30 on 1 May in Kyiv —
    // the two timezones disagree about which month "now" belongs to.
    const instant = new Date('2026-04-30T23:30:00Z')
    expect(currentMonthRange('Europe/Kyiv', instant)).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
    })
    expect(currentMonthRange('UTC', instant)).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('never lands on the previous month for timezones behind UTC', () => {
    // Regression guard for the getDateRangeForPeriod('thisMonth') pitfall: it
    // derives the last day by reformatting a UTC-midnight Date in the profile
    // timezone, which slips to the 30th for negative offsets.
    expect(currentMonthRange('America/New_York', new Date('2026-05-17T12:00:00Z')).to).toBe(
      '2026-05-31'
    )
  })
})
