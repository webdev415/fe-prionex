/**
 * Reading a stored date back for a picker.
 *
 * The trap this exists to avoid: `new Date('1994-05-12')` is parsed as UTC
 * midnight and then rendered in local time, so anywhere west of Greenwich it
 * shows as the 11th. Open a dialog and save it again and the date walks
 * backwards a day at a time.
 */

import { describe, expect, it } from 'vitest'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'

describe('parsePickerYMD', () => {
  it('gives back the day that was stored, not the one before it', () => {
    const parsed = parsePickerYMD('1994-05-12') as Date

    expect(parsed.getFullYear()).toBe(1994)
    expect(parsed.getMonth()).toBe(4)
    expect(parsed.getDate()).toBe(12)
  })

  it('survives a round trip through the formatter unchanged', () => {
    expect(formatPickerDateAsYMD(parsePickerYMD('2020-09-03') as Date)).toBe('2020-09-03')
    expect(formatPickerDateAsYMD(parsePickerYMD('2024-01-01') as Date)).toBe('2024-01-01')
  })

  it('reads a date nobody has filled in as no date', () => {
    expect(parsePickerYMD(null)).toBeNull()
    expect(parsePickerYMD(undefined)).toBeNull()
    expect(parsePickerYMD('')).toBeNull()
  })

  it('refuses what is not a date rather than inventing one', () => {
    expect(parsePickerYMD('not-a-date')).toBeNull()
    expect(parsePickerYMD('1994-05')).toBeNull()
    expect(parsePickerYMD('0000-00-00')).toBeNull()
  })
})
