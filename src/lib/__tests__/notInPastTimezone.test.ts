/**
 * KAN-992 AC5 — "past" is measured in the operator's PROFILE timezone.
 *
 * The pickers hand react-datepicker plain `Date`s, so the wall time a slot
 * shows is whatever the browser's zone renders. What that wall time *means* is
 * decided later: `toUtcIsoIfDate` re-reads it as profile-timezone before
 * saving. Comparing slots against a raw `new Date()` therefore measured "past"
 * on a different clock from the one that stores the value — with the zones
 * apart, the picker offered a slot the save-time check then rejected.
 *
 * These tests never assume the host's zone. They pin behaviour by asking for
 * two zones far apart and asserting the answers DIFFER — which can only happen
 * if the timezone argument is genuinely consulted. A browser-clock
 * implementation returns the same answer for both and fails.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getDateTimeStringInTimezone,
  notInPastTimeFilter,
  nowAsWallTimeInTimezone,
  wallTimeAsTimezoneToUtcIso,
} from '../dateUtils'

// 2026-08-20T07:00:00Z. In August: Kyiv is UTC+3 (10:00), Honolulu UTC-10
// (21:00 the PREVIOUS day), Kiritimati UTC+14 (21:00 the same day).
const INSTANT = new Date('2026-08-20T07:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(INSTANT)
})
afterEach(() => vi.useRealTimers())

describe('nowAsWallTimeInTimezone', () => {
  it('reports the wall time the profile zone is showing', () => {
    const kyiv = nowAsWallTimeInTimezone('Europe/Kyiv')
    expect(kyiv.getHours()).toBe(10)
    expect(kyiv.getMinutes()).toBe(0)
    expect(kyiv.getDate()).toBe(20)
  })

  it('is genuinely zone-dependent, not the host clock wearing a label', () => {
    // Same instant, two zones, 24 hours apart. A browser-clock implementation
    // cannot tell these apart.
    const honolulu = nowAsWallTimeInTimezone('Pacific/Honolulu')
    const kiritimati = nowAsWallTimeInTimezone('Pacific/Kiritimati')

    expect(honolulu.getDate()).toBe(19)
    expect(honolulu.getHours()).toBe(21)
    expect(kiritimati.getDate()).toBe(20)
    expect(kiritimati.getHours()).toBe(21)
  })

  it('keeps sub-minute precision so the current slot stays blocked', () => {
    // getDateTimeStringInTimezone is minute-precision. Rounding down would let
    // the slot covering the current minute through here while the save-time
    // check still rejected it — the same split-clock bug in miniature.
    vi.setSystemTime(new Date('2026-08-20T07:00:45.000Z'))
    expect(nowAsWallTimeInTimezone('Europe/Kyiv').getSeconds()).toBe(45)
  })

  it('falls back to the real clock when no zone is configured', () => {
    expect(nowAsWallTimeInTimezone(undefined).getTime()).toBe(INSTANT.getTime())
    expect(nowAsWallTimeInTimezone(null).getTime()).toBe(INSTANT.getTime())
  })
})

describe('notInPastTimeFilter', () => {
  // Slots are browser-local wall times, which is what the picker renders.
  const slotOn20th = (h: number) => new Date(2026, 7, 20, h, 0, 0, 0)

  it('blocks a slot before the profile-zone moment and keeps one after', () => {
    const inKyiv = notInPastTimeFilter('Europe/Kyiv') // 10:00 on the 20th
    expect(inKyiv(slotOn20th(9))).toBe(false)
    expect(inKyiv(slotOn20th(11))).toBe(true)
  })

  it('answers differently for two zones on the same slot', () => {
    // 20th 09:00 is past in Kiritimati (already 21:00 there) and future in
    // Honolulu (still the 19th). Only a zone-aware filter can split these.
    const slot = slotOn20th(9)
    expect(notInPastTimeFilter('Pacific/Kiritimati')(slot)).toBe(false)
    expect(notInPastTimeFilter('Pacific/Honolulu')(slot)).toBe(true)
  })

  it('leaves every slot on a later day alone', () => {
    const inKyiv = notInPastTimeFilter('Europe/Kyiv')
    expect(inKyiv(new Date(2026, 7, 21, 0, 0))).toBe(true)
    expect(inKyiv(new Date(2026, 7, 21, 23, 45))).toBe(true)
  })

  it('recomputes "now" per call rather than capturing it', () => {
    // The picker can sit open across the boundary; a captured "now" would keep
    // offering a slot that has since passed.
    const inKyiv = notInPastTimeFilter('Europe/Kyiv')
    expect(inKyiv(slotOn20th(11))).toBe(true)

    vi.setSystemTime(new Date('2026-08-20T09:00:00.000Z')) // 12:00 Kyiv
    expect(inKyiv(slotOn20th(11))).toBe(false)
  })

  it('returns one stable function per zone', () => {
    // react-datepicker re-renders the whole time list when filterTime changes
    // identity, so a fresh closure per render made the list thrash. That is why
    // the pre-timezone version was a module-level constant.
    expect(notInPastTimeFilter('Europe/Kyiv')).toBe(notInPastTimeFilter('Europe/Kyiv'))
    expect(notInPastTimeFilter('Europe/Kyiv')).not.toBe(notInPastTimeFilter('Pacific/Honolulu'))
  })
})

/**
 * Reported from the UI: with a Kyiv profile at 00:16 Kyiv, the picker still
 * offered the previous day and every slot on it.
 *
 * Root cause was not the timezone plumbing but ``Intl``: ``hour12: false``
 * resolves to the h24 cycle on some engines, so the midnight hour formatted as
 * "24:16". `getDateTimeStringInTimezone` then built an unparseable string, and
 * every caller that reads it back fell through to its fallback — silently, and
 * only ever between 00:00 and 00:59 in the target zone.
 */
describe('the h24 midnight hour', () => {
  // 21:16 UTC = 00:16 the NEXT day in Kyiv — inside the broken hour.
  const MIDNIGHT_KYIV = new Date('2026-08-20T21:16:00.000Z')

  it('formats midnight as 00, not 24', () => {
    expect(getDateTimeStringInTimezone(MIDNIGHT_KYIV, 'Europe/Kyiv')).toBe('2026-08-21T00:16')
  })

  it('still yields a usable Date during that hour', () => {
    vi.setSystemTime(MIDNIGHT_KYIV)
    const wall = nowAsWallTimeInTimezone('Europe/Kyiv')
    expect(isNaN(wall.getTime())).toBe(false)
    expect(wall.getDate()).toBe(21)
    expect(wall.getHours()).toBe(0)
    expect(wall.getMinutes()).toBe(16)
  })

  it('does not save a 21:xx wall time one day early', () => {
    // A UTC+3 wall time of 21:xx lands on hour 0 of the next day when formatted
    // back, so the h24 reading fed 24 into Date.UTC and rolled the day forward
    // — the computed offset came out 24 hours off.
    expect(wallTimeAsTimezoneToUtcIso('2026-08-20T21:30', 'Europe/Kyiv')).toBe(
      '2026-08-20T18:30:00.000Z'
    )
    // Neighbours, which never hit the broken hour, must be unchanged.
    expect(wallTimeAsTimezoneToUtcIso('2026-08-20T20:30', 'Europe/Kyiv')).toBe(
      '2026-08-20T17:30:00.000Z'
    )
    expect(wallTimeAsTimezoneToUtcIso('2026-08-20T22:30', 'Europe/Kyiv')).toBe(
      '2026-08-20T19:30:00.000Z'
    )
  })

  it('blocks every slot on a day that has already passed', () => {
    // The second half of the report: with Kyiv already on the 21st, the 20th
    // was offering all 96 slots because only "same day" was special-cased.
    vi.setSystemTime(MIDNIGHT_KYIV)
    const inKyiv = notInPastTimeFilter('Europe/Kyiv')
    expect(inKyiv(new Date(2026, 7, 20, 23, 45))).toBe(false)
    expect(inKyiv(new Date(2026, 7, 20, 12, 0))).toBe(false)
    // …while the current day still discriminates by time.
    expect(inKyiv(new Date(2026, 7, 21, 0, 0))).toBe(false)
    expect(inKyiv(new Date(2026, 7, 21, 0, 30))).toBe(true)
  })
})
