/**
 * Display formatting for the feed's plain calendar days.
 *
 * Every date column of this feed (`sell_date`, `assignment_date`,
 * `last_interaction_date`) is a backend DATE — a calendar day, not an instant.
 * Handing `"2026-07-29"` straight to `formatDate` would parse it as UTC
 * midnight and then re-render it in the BROWSER's timezone, which shows the
 * previous day everywhere west of Greenwich. Anchoring the string at LOCAL
 * midnight (`…T00:00:00`, which ECMAScript parses as local time) keeps the day
 * verbatim in every timezone.
 *
 * This is also why the tab never shifts `last_interaction_date`: the backend
 * cuts it in UTC by Card 148 parity, and a client-side conversion would move
 * it under the viewer's clock (see docs/low-verification-feed.md, "Frozen date
 * cuts").
 */

import { formatDate } from '@/lib/localeFormat'

/** Placeholder for a missing or unparseable value (shared table convention). */
const EMPTY = '—'

/**
 * Format a `YYYY-MM-DD` backend day in the UI language (en → MM/DD/YYYY,
 * uk → DD.MM.YYYY). Null, empty and unparseable values render "—".
 */
export function formatCalendarDay(value: string | null | undefined, language: string): string {
  if (!value) return EMPTY
  // `formatDate` already returns "—" for an unparseable input, so a malformed
  // payload degrades instead of rendering "Invalid Date".
  return formatDate(`${value}T00:00:00`, language)
}
