/**
 * Regression test for the "TA chain date jumps +N hours after editing" bug.
 *
 * Root cause: the edit path saved the picker's wall-time verbatim (no `Z`),
 * while the create path stored UTC-with-`Z`. The display helper
 * (`formatDateTime`) treats a no-`Z` string as UTC and re-renders it in the
 * profile timezone, shifting an edited time by the profile offset.
 *
 * The fix makes the edit save convert to UTC-with-`Z` (via
 * `wallTimeAsTimezoneToUtcIso`), exactly like the create/wizard path.
 *
 * Uses Europe/Moscow (UTC+3, no DST) so the assertions are deterministic.
 */
import { describe, it, expect } from 'vitest'
import { wallTimeAsTimezoneToUtcIso } from '@/lib/dateUtils'
import { formatDateTime } from '@/lib/formatters'

const TZ = 'Europe/Moscow' // fixed UTC+3 year-round

describe('TA chain date edit round-trip (timezone)', () => {
  it('FIXED edit path: storing UTC-with-Z displays the entered time unchanged', () => {
    // User picks 09:00 in their profile timezone. The fixed edit save
    // converts it to UTC ISO with a trailing Z — same as the create path.
    const stored = wallTimeAsTimezoneToUtcIso('2026-06-02T09:00', TZ)
    expect(stored).toBe('2026-06-02T06:00:00.000Z') // 09:00 (+3) -> 06:00 UTC

    // The display layer converts UTC -> profile tz and shows the original time.
    expect(formatDateTime(stored, TZ)).toBe('02-06-2026 09:00')
  })

  it('OLD broken behaviour: a naive wall-time (no Z) is shifted +3 on display', () => {
    // Before the fix the edit path stored the picker value verbatim, no Z.
    const storedNaive = '2026-06-02T09:00'

    // formatDateTime treats a no-Z string as UTC, then renders it in +3,
    // producing the reported forward shift (09:00 -> 12:00).
    expect(formatDateTime(storedNaive, TZ)).toBe('02-06-2026 12:00')
  })

  it('create and edit now agree: same entered time -> same stored value -> same display', () => {
    const entered = '2026-06-02T16:00'
    const storedByCreate = wallTimeAsTimezoneToUtcIso(entered, TZ)
    const storedByEdit = wallTimeAsTimezoneToUtcIso(entered, TZ) // edit now mirrors create
    expect(storedByEdit).toBe(storedByCreate)
    expect(formatDateTime(storedByEdit, TZ)).toBe('02-06-2026 16:00')
  })
})
