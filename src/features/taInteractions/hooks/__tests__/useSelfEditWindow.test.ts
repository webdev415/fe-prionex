/**
 * The 5-minute self-edit window, UI side (KAN-1110).
 *
 * The API is the real gate. These cover what the UI owes: showing the buttons
 * to the right person for the right five minutes, and — the part that is easy
 * to get wrong — judging each record by its own clock.
 */
import { describe, expect, it } from 'vitest'

import { canMutateInteraction } from '../useSelfEditWindow'

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
