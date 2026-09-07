/**
 * Pure YYYY-MM-DD month arithmetic for the report's two windows: the default
 * one (today → end of the current month — the report's namesake period) and
 * the «Весь місяць» one (1st → end of the current month).
 *
 * String math over the date's own parts, never `new Date(string)`: a bare
 * YYYY-MM-DD parses as UTC midnight, which west of Greenwich reads back as the
 * previous local day and would shift the month boundary itself.
 */

/** First day of the given day's month ("2026-07-15" → "2026-07-01"). */
export function startOfMonthYMD(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

/**
 * Last day of the given day's month ("2026-07-15" → "2026-07-31").
 *
 * Day 0 of the NEXT month is this month's last day; `Date.UTC` keeps the
 * arithmetic immune to the host timezone and to DST.
 */
export function endOfMonthYMD(ymd: string): string {
  const year = Number(ymd.slice(0, 4))
  const month = Number(ymd.slice(5, 7))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${ymd.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
}
