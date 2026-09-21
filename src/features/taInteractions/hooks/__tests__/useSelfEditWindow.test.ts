/**
 * The 5-minute self-edit window, UI side (KAN-1110).
 *
 * The API is the real gate. These cover what the UI owes: showing the buttons
 * to the right person for the right five minutes, and — the part that is easy
 * to get wrong — judging each record by its own clock.
 */
import { describe, expect, it } from 'vitest'

import { canMutateInteraction, parseUtcTimestamp } from '../useSelfEditWindow'

const AUTHOR = 42
const OTHER = 43
const T0 = Date.parse('2026-09-18T12:00:00Z')
const MIN = 60_000

const row = (
  overrides: Partial<{ recorded_by: number | null; self_edit_expires_at: string }> = {}
) => ({
  recorded_by: AUTHOR as number | null,
  self_edit_expires_at: new Date(T0 + 5 * MIN).toISOString(),
  ...overrides,
})

describe('the permission path is unchanged', () => {
  it('a permission holder may act on someone else’s ancient record', () => {
    const ancient = row({
      recorded_by: OTHER,
      self_edit_expires_at: new Date(T0 - 99 * MIN).toISOString(),
    })
    expect(canMutateInteraction(ancient, AUTHOR, true, T0)).toBe(true)
  })

  it('a permission holder is not blocked by a missing author', () => {
    expect(canMutateInteraction(row({ recorded_by: null }), AUTHOR, true, T0)).toBe(true)
  })
})

describe('the self-edit window', () => {
  it('the author may act inside the window', () => {
    expect(canMutateInteraction(row(), AUTHOR, false, T0 + MIN)).toBe(true)
  })

  it('the author may not act once it has closed', () => {
    expect(canMutateInteraction(row(), AUTHOR, false, T0 + 5 * MIN + 1)).toBe(false)
  })

  it('the boundary is exclusive', () => {
    expect(canMutateInteraction(row(), AUTHOR, false, T0 + 5 * MIN - 1)).toBe(true)
    expect(canMutateInteraction(row(), AUTHOR, false, T0 + 5 * MIN)).toBe(false)
  })

  it('someone else may not, however fresh the record is', () => {
    expect(canMutateInteraction(row(), OTHER, false, T0)).toBe(false)
  })

  it('an unattributed record belongs to nobody', () => {
    expect(canMutateInteraction(row({ recorded_by: null }), AUTHOR, false, T0)).toBe(false)
  })

  it('an unknown current user gets nothing', () => {
    expect(canMutateInteraction(row(), null, false, T0)).toBe(false)
    expect(canMutateInteraction(row(), undefined, false, T0)).toBe(false)
  })

  it('an unparseable timestamp closes the window rather than opening it', () => {
    expect(canMutateInteraction(row({ self_edit_expires_at: 'nope' }), AUTHOR, false, T0)).toBe(
      false
    )
  })
})

describe('each record has its own timer', () => {
  it('an expired record does not close a fresher one', () => {
    const older = row({ self_edit_expires_at: new Date(T0 + MIN).toISOString() })
    const newer = row({ self_edit_expires_at: new Date(T0 + 9 * MIN).toISOString() })
    const now = T0 + 5 * MIN
    expect(canMutateInteraction(older, AUTHOR, false, now)).toBe(false)
    expect(canMutateInteraction(newer, AUTHOR, false, now)).toBe(true)
  })

  it('three records saved minutes apart expire independently', () => {
    const rows = [1, 4, 8].map((m) =>
      row({ self_edit_expires_at: new Date(T0 + m * MIN).toISOString() })
    )
    const now = T0 + 5 * MIN
    expect(rows.map((r) => canMutateInteraction(r, AUTHOR, false, now))).toEqual([
      false,
      false,
      true,
    ])
  })
})

/**
 * The API sends `self_edit_expires_at` with python's naive `utcnow()`, so it
 * arrives with NO zone marker — `2026-09-18T12:05:00`. Every fixture above
 * builds its timestamps with `Date.toISOString()`, which always appends `Z`,
 * so none of them exercises the shape the backend actually produces.
 *
 * That gap hid a bug that made the whole feature a no-op in production: a bare
 * `Date.parse` reads a zoneless date-time as LOCAL, shifting the instant by the
 * viewer's offset. In Europe/Kyiv (UTC+3) the window read as closed the moment
 * the record was saved, so the button never appeared for the operators this was
 * built for.
 *
 * These pin the wire format itself. `naive()` deliberately strips the `Z`
 * rather than taking a hand-written literal, so the fixtures stay tied to the
 * instants the other tests use.
 */
describe('the timestamp the API actually sends', () => {
  const naive = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, '')

  it('a zoneless expiry is read as UTC, not as the viewer’s local time', () => {
    const open = row({ self_edit_expires_at: naive(T0 + 5 * MIN) })
    expect(canMutateInteraction(open, AUTHOR, false, T0)).toBe(true)
  })

  it('a zoneless expiry that has passed still closes the window', () => {
    const closed = row({ self_edit_expires_at: naive(T0 - MIN) })
    expect(canMutateInteraction(closed, AUTHOR, false, T0)).toBe(false)
  })

  it('agrees with the Z-suffixed form for the same instant', () => {
    const withZ = row({ self_edit_expires_at: new Date(T0 + MIN).toISOString() })
    const without = row({ self_edit_expires_at: naive(T0 + MIN) })
    expect(canMutateInteraction(without, AUTHOR, false, T0)).toBe(
      canMutateInteraction(withZ, AUTHOR, false, T0)
    )
  })

  it('the boundary lands in the same place with or without the marker', () => {
    // One ms before expiry is open, exactly at expiry is closed — and the
    // zoneless form must not move that by a whole timezone offset.
    const at = naive(T0 + 5 * MIN)
    expect(
      canMutateInteraction(row({ self_edit_expires_at: at }), AUTHOR, false, T0 + 5 * MIN - 1)
    ).toBe(true)
    expect(
      canMutateInteraction(row({ self_edit_expires_at: at }), AUTHOR, false, T0 + 5 * MIN)
    ).toBe(false)
  })
})

describe('parseUtcTimestamp', () => {
  it('treats a zoneless timestamp as UTC', () => {
    expect(parseUtcTimestamp('2026-09-18T12:00:00')).toBe(Date.parse('2026-09-18T12:00:00Z'))
  })

  it('leaves an explicit Z alone', () => {
    expect(parseUtcTimestamp('2026-09-18T12:00:00Z')).toBe(Date.parse('2026-09-18T12:00:00Z'))
  })

  it('leaves an explicit offset alone', () => {
    expect(parseUtcTimestamp('2026-09-18T15:00:00+03:00')).toBe(Date.parse('2026-09-18T12:00:00Z'))
  })

  it('accepts the space-separated form postgres sometimes yields', () => {
    expect(parseUtcTimestamp('2026-09-18 12:00:00')).toBe(Date.parse('2026-09-18T12:00:00Z'))
  })

  it('keeps sub-second precision', () => {
    expect(parseUtcTimestamp('2026-09-18T12:00:00.250')).toBe(
      Date.parse('2026-09-18T12:00:00.250Z')
    )
  })

  it('is NaN for junk, null and empty — every caller reads that as “no window”', () => {
    expect(parseUtcTimestamp('nope')).toBeNaN()
    expect(parseUtcTimestamp(null)).toBeNaN()
    expect(parseUtcTimestamp('')).toBeNaN()
  })
})
