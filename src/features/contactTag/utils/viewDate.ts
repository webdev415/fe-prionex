/**
 * The REQUIRED reference day («Дата перегляду», `?kd=`) as it travels through
 * the URL.
 *
 * Same reason this feed needs its own reader for the sell window's upper bound
 * (`sellWindow.ts`): the shared `readUrlDateBound` FOLDS "absent" and "empty"
 * together — `value: undefined` for both — which is right for every optional
 * bound on the Reports page and wrong for a parameter that has no "unset"
 * state at all.
 *
 * | `?kd=` | meaning |
 * |---|---|
 * | key ABSENT | nobody pinned a day — the tab's own default (today in the profile timezone) fills in, and is deliberately not written back to the URL |
 * | `?kd=` (EMPTY) | the key is THERE and says nothing. There is no such feed: `view_date` is required, both staleness thresholds and the promise gate are measured against it, and the backend answers 422 without it |
 * | `?kd=2026-08-26` | that day, if it is a real one |
 *
 * The middle row is the whole point. Folded into "absent" it would silently
 * become today — a hand-edited (or half-truncated) link would then quietly
 * answer a question nobody asked, with a reference day the URL does not state
 * and the operator has no reason to distrust. So it goes down the SAME path as
 * `?kd=2026-02-31`: an inline hint on the field, an empty field rather than the
 * default standing in for it, and no request at all.
 *
 * `isRealCalendarDate`, not a shape-only regex: V8's `Date.parse` lazily reads
 * an impossible day like 2026-02-31 as March 3rd, so a shape check would wave
 * it through to the API as a date nobody typed.
 */

import { isRealCalendarDate } from '@/lib/calendarDate'

export interface ViewDateBound {
  /** The usable YYYY-MM-DD day; undefined when the key is absent OR unusable. */
  value: string | undefined
  /**
   * True when the key is PRESENT and carries no usable day — empty, or not a
   * real calendar date. The tab shows the hint on the field and sends nothing.
   */
  isInvalid: boolean
}

/** Read the reference day off the committed URL params. */
export function readViewDateBound(searchParams: URLSearchParams, key: string): ViewDateBound {
  const raw = searchParams.get(key)
  // Absent — the tab's default day applies. The state a shared link that never
  // touched the field carries, and the state the tab opens in.
  if (raw === null) return { value: undefined, isInvalid: false }
  const isInvalid = raw === '' || !isRealCalendarDate(raw)
  return { value: isInvalid ? undefined : raw, isInvalid }
}
