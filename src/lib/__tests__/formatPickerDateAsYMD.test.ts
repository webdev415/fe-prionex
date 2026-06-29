import { describe, expect, it } from 'vitest'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'

describe('formatPickerDateAsYMD', () => {
  it('returns the calendar day for a DateSelect local-midnight Date', () => {
    const picked = new Date(2026, 5, 11, 0, 0, 0, 0)
    expect(formatPickerDateAsYMD(picked)).toBe('2026-06-11')
  })

  it('avoids UTC day shift that breaks toISOString in UTC+ timezones', () => {
    const picked = new Date(2026, 5, 11, 0, 0, 0, 0)
    const ymd = formatPickerDateAsYMD(picked)

    expect(ymd).toBe('2026-06-11')

    // East of UTC: local midnight is still the previous UTC calendar day.
    if (picked.getTimezoneOffset() < 0) {
      expect(picked.toISOString().split('T')[0]).toBe('2026-06-10')
      expect(ymd).not.toBe(picked.toISOString().split('T')[0])
    }
  })
})
