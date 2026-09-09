import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatClientFullName, formatDate, formatIsoDate } from '@/lib/formatters'

describe('formatClientFullName', () => {
  it('returns "Last First Middle" when all three are present', () => {
    expect(
      formatClientFullName({
        first_name: 'Олексій',
        middle_name: 'Михайлович',
        last_name: 'Іванов',
      })
    ).toBe('Іванов Олексій Михайлович')
  })

  it('returns "Last First" when middle is null (no trailing space)', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: null, last_name: 'Іванов' })
    ).toBe('Іванов Олексій')
  })

  it('returns "Last First" when middle is empty string', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: '', last_name: 'Іванов' })
    ).toBe('Іванов Олексій')
  })

  it('returns empty string when all fields are null', () => {
    expect(formatClientFullName({ first_name: null, middle_name: null, last_name: null })).toBe('')
  })

  it('returns empty string when all fields are undefined', () => {
    expect(formatClientFullName({})).toBe('')
  })

  it('returns "Last" only when first and middle are absent', () => {
    expect(formatClientFullName({ first_name: null, middle_name: null, last_name: 'Іванов' })).toBe(
      'Іванов'
    )
  })

  it('returns "First" only when last and middle are absent', () => {
    expect(
      formatClientFullName({ first_name: 'Олексій', middle_name: null, last_name: null })
    ).toBe('Олексій')
  })

  it('skips missing first while keeping last and middle in correct slots', () => {
    expect(
      formatClientFullName({ first_name: null, middle_name: 'Михайлович', last_name: 'Іванов' })
    ).toBe('Іванов Михайлович')
  })
})

/**
 * `formatDate` on a bare calendar date (KAN-1067 review).
 *
 * Two properties are at stake and they pull against each other. A bare
 * `YYYY-MM-DD` must render the same day in every browser timezone, which means
 * splitting the string instead of instantiating a Date. But a shape match is
 * not an existence check, and the backend emits `0000-00-00` for "no date" —
 * so the string path must stay closed to days that do not exist, or the
 * em-dash turns into `00-00-0000` across the ~49 modules that call this.
 */
describe('formatDate — bare calendar dates', () => {
  // West of UTC is where the old Date path lost a day: `new Date('2026-10-02')`
  // is UTC midnight, and `getDate()` reads that back as the 1st in America/*.
  // Kyiv (UTC+2/+3) rounds the other way, which is why this shipped unnoticed.
  //
  // `stubEnv` rather than touching `process.env` directly: the app's build
  // tsconfig carries no node types, so a bare `process` fails `tsc -b` even
  // though the test itself runs fine.
  beforeAll(() => {
    vi.stubEnv('TZ', 'America/New_York')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('renders the calendar day itself, not the day the viewer’s zone lands on', () => {
    expect(formatDate('2026-10-02')).toBe('02-10-2026')
    expect(new Date('2026-10-02').getDate()).toBe(1) // the trap this avoids
  })

  it('keeps the Date path for a string that carries a time', () => {
    // An instant, not a calendar date: the viewer's own zone is the point.
    // 02:00Z on the 3rd is still 22:00 on the 2nd at UTC-4 (EDT).
    expect(formatDate('2026-10-03T02:00:00Z')).toBe('02-10-2026')
  })

  it('still answers — for a backend zero-date', () => {
    expect(formatDate('0000-00-00')).toBe('—')
  })

  it('still answers — for an out-of-range month or day', () => {
    expect(formatDate('2026-13-45')).toBe('—')
    expect(formatDate('2026-13-01')).toBe('—')
    expect(formatDate('2026-00-10')).toBe('—')
  })

  it('still answers — for a day that does not exist in that month', () => {
    // Shape-valid and inside 1-12/1-31, so only a real existence check catches
    // it: `new Date('2026-02-31')` does NOT return Invalid Date, it rolls over
    // to 02-03-2026 — a date the operator would read as real.
    expect(formatDate('2026-02-31')).toBe('—')
    expect(formatDate('2026-04-31')).toBe('—')
  })

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(formatDate('2024-02-29')).toBe('29-02-2024')
    expect(formatDate('2026-02-29')).toBe('—')
  })

  it('answers — for empty, undefined and unparseable input', () => {
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })
})

describe('formatIsoDate', () => {
  it('flips a bare ISO date to DD-MM-YYYY', () => {
    expect(formatIsoDate('2026-04-16')).toBe('16-04-2026')
  })

  it('truncates a datetime to its date part', () => {
    expect(formatIsoDate('2026-04-16T00:00:00Z')).toBe('16-04-2026')
  })

  it('answers — for null, empty and malformed input', () => {
    expect(formatIsoDate(null)).toBe('—')
    expect(formatIsoDate(undefined)).toBe('—')
    expect(formatIsoDate('')).toBe('—')
    expect(formatIsoDate('16-04-2026')).toBe('—')
  })
})
