import { describe, it, expect } from 'vitest'
import { formatCalendarDay } from '../calendarDay'

describe('formatCalendarDay', () => {
  it('formats a backend day in the UI language', () => {
    expect(formatCalendarDay('2026-07-29', 'en')).toBe('07/29/2026')
    expect(formatCalendarDay('2026-07-29', 'uk')).toBe('29.07.2026')
  })

  it('keeps the calendar day verbatim regardless of the host timezone', () => {
    // The value is a DATE, not an instant: parsed as UTC midnight it would
    // render as the 28th anywhere west of Greenwich. Anchoring at LOCAL
    // midnight makes the output independent of the runtime's zone — asserted
    // here by comparing against the same day built locally.
    const local = new Date(2026, 0, 1)
    expect(formatCalendarDay('2026-01-01', 'en')).toBe(
      new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(local)
    )
  })

  it('renders "—" for missing values', () => {
    expect(formatCalendarDay(null, 'en')).toBe('—')
    expect(formatCalendarDay(undefined, 'en')).toBe('—')
    expect(formatCalendarDay('', 'en')).toBe('—')
  })

  it('renders "—" instead of "Invalid Date" for a malformed payload', () => {
    expect(formatCalendarDay('not-a-date', 'en')).toBe('—')
    expect(formatCalendarDay('2026-13-45', 'en')).toBe('—')
  })
})
