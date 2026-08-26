import { describe, expect, it } from 'vitest'
import { readSellToState, sellToRequestParam, type SellToState } from '../sellWindow'

/**
 * The three-valued upper bound is the one contract detail of this feed that a
 * two-valued implementation would silently get wrong — "not set" would collapse
 * into "no bound" (or the other way round) and either re-apply a four-month
 * default the operator just switched off, or drop a default they never touched.
 * These are the unit-level pins; the tab suite drives the same three states end
 * to end (URL → request → what is rendered).
 */

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('readSellToState', () => {
  it('reads an ABSENT key as the backend-default state', () => {
    const state = readSellToState(params(''), 'kt')

    expect(state).toEqual({ mode: 'default', value: undefined, isInvalid: false })
  })

  it('reads a PRESENT-BUT-EMPTY key as the switched-off state', () => {
    // `?kt=` — URLSearchParams gives '' here and null for an absent key, which
    // is the entire mechanism. A reader built on `raw ? … : …` (the shape the
    // shared readUrlDateBound uses) would report `default` here.
    const state = readSellToState(params('kt='), 'kt')

    expect(state).toEqual({ mode: 'off', value: undefined, isInvalid: false })
  })

  it('reads a real date as the explicit state', () => {
    const state = readSellToState(params('kt=2026-06-30'), 'kt')

    expect(state).toEqual({ mode: 'explicit', value: '2026-06-30', isInvalid: false })
  })

  it.each([
    ['a day the month does not have', '2026-02-31'],
    ['a month that does not exist', '2026-13-01'],
    ['a value of the wrong shape', 'yesterday'],
  ])('flags %s as invalid without a usable value', (_case, raw) => {
    // Shape-only validation would let 2026-02-31 through: V8 reads it as
    // March 3rd, so every later comparison would pass and the API would be
    // asked about a day nobody typed.
    const state = readSellToState(params(`kt=${raw}`), 'kt')

    expect(state.isInvalid).toBe(true)
    expect(state.value).toBeUndefined()
    // Still `explicit`: the user DID pin a bound, it is simply unusable —
    // reporting `default` would claim the backend's window is in force while
    // the tab refuses to fetch anything at all.
    expect(state.mode).toBe('explicit')
  })

  it('reads only its own key out of a URL full of the other tabs’ params', () => {
    const search = params('tab=contact-tag&st=2026-01-01&pt=2026-02-02&gt=2026-03-03&kt=')

    expect(readSellToState(search, 'kt').mode).toBe('off')
    // ...and the sibling keys keep their own values, unread by this tab.
    expect(readSellToState(search, 'st').value).toBe('2026-01-01')
  })
})

describe('sellToRequestParam', () => {
  const state = (over: Partial<SellToState>): SellToState => ({
    mode: 'default',
    value: undefined,
    isInvalid: false,
    ...over,
  })

  it('OMITS the key entirely in the default state', () => {
    const built = sellToRequestParam(state({ mode: 'default' }))

    // `toStrictEqual` on purpose: `{ sell_to: undefined }` passes a loose
    // toEqual against `{}` and serialises identically through axios TODAY —
    // but it is a different object shape, and the whole contract rests on the
    // key being genuinely absent.
    expect(built).toStrictEqual({})
    expect('sell_to' in built).toBe(false)
  })

  it('sends an EMPTY string in the off state', () => {
    // Axios drops null/undefined params and keeps empty strings, so this is
    // what puts a bare `sell_to=` on the wire — the backend's signal to switch
    // the upper bound off. `undefined` here would silently mean "default".
    expect(sellToRequestParam(state({ mode: 'off' }))).toStrictEqual({ sell_to: '' })
  })

  it('sends the date in the explicit state', () => {
    expect(sellToRequestParam(state({ mode: 'explicit', value: '2026-06-30' }))).toStrictEqual({
      sell_to: '2026-06-30',
    })
  })

  it('falls back to "no upper bound", never to the default, for an unusable explicit state', () => {
    // Unreachable through the tab (an invalid bound blocks the request), and
    // the fallback direction is the safe one: switching the bound off shows
    // MORE rows, whereas silently re-applying a four-month-old default would
    // hide clients the operator asked about.
    expect(
      sellToRequestParam(state({ mode: 'explicit', value: undefined, isInvalid: true }))
    ).toStrictEqual({ sell_to: '' })
  })

  it('produces three DISTINCT request shapes — one per state', () => {
    // What makes the three states three different React Query keys, and hence
    // three different fetches rather than one cached answer replayed.
    const shapes = [
      sellToRequestParam(state({ mode: 'default' })),
      sellToRequestParam(state({ mode: 'off' })),
      sellToRequestParam(state({ mode: 'explicit', value: '2026-06-30' })),
    ].map((shape) => JSON.stringify(shape))

    expect(new Set(shapes).size).toBe(3)
  })
})
