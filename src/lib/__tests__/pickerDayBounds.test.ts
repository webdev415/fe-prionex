/**
 * A picked calendar day, bounded in the user's profile timezone.
 *
 * The picker hands back browser-local midnight. When the profile zone differs
 * from the browser's, bounding by that instant filters the wrong rows around
 * both ends of the day. The suite runs with TZ=UTC (vitest.config.ts).
 */

import { describe, expect, it } from 'vitest'
import { pickerDayEndUtcIso, pickerDayStartUtcIso } from '../dateUtils'

const SEP_1 = new Date(2026, 8, 1)

describe('pickerDayStartUtcIso / pickerDayEndUtcIso', () => {
  it('bounds a day east of UTC', () => {
    // Kyiv is UTC+3 in September.
    expect(pickerDayStartUtcIso(SEP_1, 'Europe/Kyiv')).toBe('2026-08-31T21:00:00.000Z')
    expect(pickerDayEndUtcIso(SEP_1, 'Europe/Kyiv')).toBe('2026-09-01T20:59:59.999Z')
  })

  it('bounds a day west of UTC', () => {
    // New York is UTC-4 in September.
    expect(pickerDayStartUtcIso(SEP_1, 'America/New_York')).toBe('2026-09-01T04:00:00.000Z')
    expect(pickerDayEndUtcIso(SEP_1, 'America/New_York')).toBe('2026-09-02T03:59:59.999Z')
  })

  it('ends a 23-hour DST day where it actually ends', () => {
    // Kyiv springs forward on 29 March 2026: the day starts at UTC+2 and ends
    // at UTC+3, 23 hours later. Start plus 24 hours would run an hour into the
    // next day.
    const day = new Date(2026, 2, 29)
    const start = pickerDayStartUtcIso(day, 'Europe/Kyiv')
    const end = pickerDayEndUtcIso(day, 'Europe/Kyiv')

    expect(start).toBe('2026-03-28T22:00:00.000Z')
    expect(end).toBe('2026-03-29T20:59:59.999Z')
    expect(Date.parse(end) + 1 - Date.parse(start)).toBe(23 * 3600 * 1000)
  })

  it('falls back to the browser zone without a profile timezone', () => {
    expect(pickerDayStartUtcIso(SEP_1, null)).toBe('2026-09-01T00:00:00.000Z')
    expect(pickerDayEndUtcIso(SEP_1, undefined)).toBe('2026-09-01T23:59:59.999Z')
  })
})
