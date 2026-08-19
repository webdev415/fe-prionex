/**
 * Display formatting for a backend DATE — a calendar day, not an instant.
 *
 * Handing `"2026-07-29"` straight to `formatDate` would parse it as UTC
 * midnight and then re-render it in the BROWSER's timezone, which shows the
 * previous day everywhere west of Greenwich. Anchoring the string at LOCAL
 * midnight (`…T00:00:00`, which ECMAScript parses as local time) keeps the day
 * verbatim in every timezone.
 *
 * Started inside the low-verification feed and moved here once the
 * communication-gap feed needed the identical rendering — the same reasoning
 * (and the same pair of features) as `isRealCalendarDate` in
 * `@/lib/calendarDate`: a pure util must not drag a feature's module graph
 * into every consumer.
 *
 * This is also why neither feed shifts its day columns client-side: the
 * backend cuts each of them in a deliberately chosen zone (the requested IANA
 * timezone for `assignment_date` / `last_promise_date`, UTC for
 * `last_interaction_date` by Metabase-card parity, none at all for the plain
 * DATE `sell_date`), and a client-side conversion would move the value under
 * the viewer's clock. See api docs/low-verification-feed.md and
 * docs/communication-gap-feed.md ("Frozen date cuts" / "Timezone").
 */

import { isRealCalendarDate } from '@/lib/calendarDate'
import { formatDate } from '@/lib/localeFormat'

/** Placeholder for a missing or unparseable value (shared table convention). */
const EMPTY = '—'

/** Length of the `YYYY-MM-DD` head every accepted value starts with. */
const CALENDAR_DAY_LENGTH = 10

/**
 * Format a `YYYY-MM-DD` backend day in the UI language (en → MM/DD/YYYY,
 * uk → DD.MM.YYYY). Null, empty and unparseable values render "—".
 */
export function formatCalendarDay(value: string | null | undefined, language: string): string {
  if (!value) return EMPTY
  // Only the CALENDAR head is anchored: `…T00:00:00` appended to a full ISO
  // datetime ("2026-07-29T14:00:00Z") parses as nothing, so a backend that
  // switched these DATE columns to timestamps would silently blank the whole
  // column. Slicing first keeps such a payload readable while an impossible or
  // malformed day still degrades to "—" (isRealCalendarDate rejects both the
  // wrong shape and days like 2026-02-31).
  const day = value.slice(0, CALENDAR_DAY_LENGTH)
  if (!isRealCalendarDate(day)) return EMPTY
  return formatDate(`${day}T00:00:00`, language)
}
