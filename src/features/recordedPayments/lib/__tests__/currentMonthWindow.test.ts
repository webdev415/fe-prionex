import { describe, expect, it } from 'vitest'
import { currentMonthToDateWindow } from '../currentMonthWindow'

/**
 * The default-window rule, pinned as a function: a `fallbackFrom: today`
 * copied from a neighbouring tab would show a DAY instead of a month and the
 * page would look perfectly fine. Pure string arithmetic, so no host timezone
 * can move any expectation below.
 */
describe('currentMonthToDateWindow', () => {
  it('runs from the 1st of the month to the given day, inclusive', () => {
    expect(currentMonthToDateWindow('2026-09-14')).toEqual({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-14',
    })
  })

  it('is a single day on the 1st — the month has only started', () => {
    // The backend's own default on the 1st is `[1st .. 1st]`; the tab must
    // send the same pair, not last month by "helpfulness".
    expect(currentMonthToDateWindow('2026-10-01')).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-01',
    })
  })

  it('never reaches past today — the month to DATE, not the whole month', () => {
    // The source system loads the month up to yesterday and the backend up
    // to today; a `dateTo` of the 31st would be a window nobody asked for.
    const window = currentMonthToDateWindow('2026-08-20')
    expect(window?.dateTo).toBe('2026-08-20')
    expect(window?.dateTo).not.toBe('2026-08-31')
  })

  it('handles a December day without touching the year', () => {
    expect(currentMonthToDateWindow('2026-12-31')).toEqual({
      dateFrom: '2026-12-01',
      dateTo: '2026-12-31',
    })
  })

  it.each(['2026-02-31', '2026-13-01', 'yesterday', ''])(
    'refuses an unusable "today" (%s) rather than inventing a window',
    (today) => {
      // Null is the honest answer: the caller then has no default to fill an
      // absent bound with, which surfaces as a blocked request instead of as
      // a wrong window.
      expect(currentMonthToDateWindow(today)).toBeNull()
    }
  )
})
