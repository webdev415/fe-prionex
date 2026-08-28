import { describe, expect, it } from 'vitest'
import { readViewDateBound } from '../viewDate'

/**
 * The reference day is REQUIRED, which makes "the key is there and empty" a
 * different fact from "the key is absent" — the same distinction the sell
 * window's upper bound is built on, and the one the shared `readUrlDateBound`
 * folds away. These are the unit-level pins; the tab suite drives the
 * consequence end to end (no request, an inline hint, an empty field).
 */

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('readViewDateBound', () => {
  it('reads an ABSENT key as "no value, nothing wrong" — the tab’s default day applies', () => {
    expect(readViewDateBound(params(''), 'kd')).toEqual({ value: undefined, isInvalid: false })
  })

  it('reads a PRESENT-BUT-EMPTY key as INVALID, not as the default', () => {
    // `?kd=` — URLSearchParams gives '' here and null for an absent key. A
    // reader built on `raw ? … : …` (the shape the shared readUrlDateBound
    // uses) reports "no value" for both, and the tab would then quietly answer
    // for TODAY under a URL that states no day at all.
    expect(readViewDateBound(params('kd='), 'kd')).toEqual({ value: undefined, isInvalid: true })
  })

  it('reads a real date as the picked day', () => {
    expect(readViewDateBound(params('kd=2026-08-26'), 'kd')).toEqual({
      value: '2026-08-26',
      isInvalid: false,
    })
  })

  it.each([
    ['a day the month does not have', '2026-02-31'],
    ['a month that does not exist', '2026-13-01'],
    ['a value of the wrong shape', 'today'],
  ])('flags %s as invalid without a usable value', (_case, raw) => {
    // Shape-only validation would let 2026-02-31 through: V8 reads it as
    // March 3rd, so the API would be asked about a day nobody typed.
    expect(readViewDateBound(params(`kd=${raw}`), 'kd')).toEqual({
      value: undefined,
      isInvalid: true,
    })
  })

  it('reads only its own key out of a URL full of the other tabs’ params', () => {
    const search = params('tab=contact-tag&sd=2026-01-01&gt=2026-03-03&kd=')

    expect(readViewDateBound(search, 'kd').isInvalid).toBe(true)
    // ...and a sibling key keeps its own value, unread by this tab.
    expect(readViewDateBound(search, 'sd').value).toBe('2026-01-01')
  })
})
