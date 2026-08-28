/**
 * The asymmetric sell window of the «Контакт/Неконтакт» feed, as a state
 * machine over ONE URL key.
 *
 * Every other date filter on the Reports page is two-valued — a bound is
 * either set or it is not. This feed's UPPER bound is three-valued, because
 * the source system's date model is *"always show the last four months'
 * portfolio unless the operator says otherwise"*, and CLEARING the field is how
 * the operator says otherwise. The backend ports that deliberately rather than
 * "cleaning it up" (api docs/contact-tag-feed.md, "The asymmetric sell
 * window"), and it can only be honoured by a frontend that keeps the three
 * states apart all the way from the URL to axios.
 *
 * ## The machine
 *
 * ```
 *                 pick a date
 *        ┌──────────────────────────────┐
 *        │                              ▼
 *   ┌─────────┐   "switch off"     ┌─────────┐
 *   │ DEFAULT │ ─────────────────► │   OFF   │
 *   │ (?kt    │                    │ (?kt=)  │
 *   │ absent) │ ◄───────────────── │         │
 *   └─────────┘   "use default"    └─────────┘
 *        ▲                              ▲
 *        │  "use default"               │  "×" on the picker
 *        │        ┌────────────┐        │
 *        └─────── │  EXPLICIT  │ ───────┘
 *                 │ (?kt=DATE) │
 *                 └────────────┘
 *                       ▲
 *                       └── pick a date (from any state)
 * ```
 *
 * | state | `?kt=` | sent to the API | what the backend applies | what it echoes |
 * |---|---|---|---|---|
 * | `default`  | key absent        | key omitted    | last day of the month FOUR months before `view_date`'s month | that date |
 * | `off`      | key present, `''` | `sell_to=`     | no upper bound | `null` |
 * | `explicit` | `2026-06-30`      | `sell_to=2026-06-30` | that date | that date |
 *
 * Three consequences that are easy to get wrong and are pinned by tests:
 *
 * 1. **absent ≠ empty.** `URLSearchParams.get` returns `''` for `?kt=` and
 *    `null` for an absent key, so the two are distinguishable — but the shared
 *    `readUrlDateBound` folds them together (`value: undefined` for both),
 *    which is right for every OTHER bound on the page and wrong for this one.
 *    Hence this module rather than a fourth caller of that helper;
 * 2. **`''` must survive to axios.** Axios drops `null`/`undefined` params and
 *    keeps empty strings, so `off` must be built as `{ sell_to: '' }` and
 *    `default` as an OMITTED key — never as `{ sell_to: undefined }`, which
 *    would silently collapse `off` into `default` and quietly re-apply a bound
 *    the operator just switched off;
 * 3. **the applied bound is only knowable from the ANSWER.** In `default` the
 *    frontend does not know the date until the response echoes it, and it
 *    deliberately does not recompute the month arithmetic (a month-offset with
 *    a day clamp and a leap-February — 2024-06-01 → 2024-02-29 — reimplemented
 *    on both sides is two implementations to keep in step). The tab renders the
 *    echo; before the first answer there is simply nothing to render.
 *
 * The LOWER bound needs none of this: `sell_from` has no default, so absent and
 * empty both mean "no lower bound" and the shared `readUrlDateBound` reads it.
 */

import { isRealCalendarDate } from '@/lib/calendarDate'

/** Which of the three states the URL currently spells. */
export type SellToMode = 'default' | 'off' | 'explicit'

export interface SellToState {
  mode: SellToMode
  /**
   * The usable YYYY-MM-DD upper bound. Defined only in `explicit` mode with a
   * real calendar day — `undefined` in `default` (the backend's business),
   * in `off` (there is no bound) and for an unusable value.
   */
  value: string | undefined
  /**
   * What the key literally spells, carried in `explicit` mode only (it equals
   * `value` for a usable date and is the unusable string otherwise).
   *
   * It exists for the UNUSABLE case: the request params are the React Query
   * key, so a state that produced the off state's `{ sell_to: '' }` would be
   * indistinguishable from actually being off — see `sellToRequestParam`.
   */
  raw?: string
  /**
   * True when the key carries a non-empty value that is not a real calendar
   * date. Such a value is NOT silently replaced by the default: the URL would
   * then disagree with both the field and the request, so it goes down the same
   * path as an inverted range — inline hint on the field, no request.
   */
  isInvalid: boolean
}

/**
 * Read the upper bound's state off the committed URL params.
 *
 * `isRealCalendarDate`, not a shape-only regex: V8's `Date.parse` lazily reads
 * an impossible day like 2026-02-31 as March 3rd, so a shape check would wave
 * it through to the API as a date nobody typed.
 *
 * An invalid value keeps `mode: 'explicit'` on purpose — the user DID pin a
 * bound, it is simply unusable, and reporting it as `default` would tell them
 * the backend's window is in force while the tab refuses to fetch anything.
 */
export function readSellToState(searchParams: URLSearchParams, key: string): SellToState {
  const raw = searchParams.get(key)
  // Absent key — the backend default applies. This is the state a shared link
  // that never touched the field carries, and the state the tab opens in.
  if (raw === null) return { mode: 'default', value: undefined, isInvalid: false }
  // Present but empty — the operator said "no upper bound".
  if (raw === '') return { mode: 'off', value: undefined, isInvalid: false }
  const isInvalid = !isRealCalendarDate(raw)
  return { mode: 'explicit', value: isInvalid ? undefined : raw, raw, isInvalid }
}

/**
 * The `sell_to` half of the request params for a given state.
 *
 * Returns an object to be SPREAD into the params, because "absent" is a
 * property that must not exist — not a property whose value is `undefined`.
 * The distinction is invisible to `toEqual` and very visible on the wire, so
 * the api-module test pins it with `toStrictEqual`.
 *
 * An `explicit` state with no usable value never reaches the WIRE (the tab
 * blocks the request on an invalid bound) — but it does reach here, because
 * these params ARE the React Query key. So an unusable bound must not collapse
 * into `{ sell_to: '' }`: that is byte-for-byte the `off` state's shape, i.e.
 * the very same key, and a disabled query on a key another state has already
 * filled would read that state's answer out of the cache — enough for the paged
 * shell's `?kpg=` self-heal to act on a response the current URL never asked
 * for. Carrying the raw, unusable string keeps the key its own; the `?? ''`
 * behind it is the safe direction for the shape that cannot occur ("no upper
 * bound" narrows nothing away silently, whereas falling back to the omitted key
 * would re-apply a four-month-old default nobody asked for).
 */
export function sellToRequestParam(state: SellToState): { sell_to?: string } {
  switch (state.mode) {
    case 'default':
      return {}
    case 'off':
      return { sell_to: '' }
    case 'explicit':
      return { sell_to: state.value ?? state.raw ?? '' }
  }
}
