/**
 * Outbound Calls Report API Types
 *
 * Backend contract for GET /api/v1/clients/reports/outbound-calls
 * (client-service, «Вихідні дзвінки» report, migrated Metabase Card 145).
 * Mirrors services/client/app/schemas/outbound_calls_report.py.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_start`/`date_end` are REQUIRED and inclusive: without a window the
 * aggregate behind this report would scan the whole call history. The tab
 * therefore always sends both, defaulted to today–today in the profile
 * timezone.
 *
 * `timezone` cuts the window's calendar days and nothing else; the backend
 * defaults to UTC when it is omitted (Card 145 parity — the card's own day
 * boundary is UTC).
 */
export interface OutboundCallsReportParams {
  project_id: number
  date_start: string // YYYY-MM-DD
  date_end: string // YYYY-MM-DD, inclusive
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One operator SEAT's outbound calling for the window.
 *
 * `sip` (the telephony extension the calls were dialled from) is the row's
 * real key — the directory holds at most one account per extension. `user_id`,
 * `fio`, `department` and `group` are null together when the directory does
 * not know the seat at all; the row still counts its calls, so the table falls
 * back to the `sip` for the operator's name. `department`/`group` are also
 * null on their own for an operator whose role carries no department (~2 % of
 * rows) or who is in no group (~15 %) — unfilled org structure, not an error.
 *
 * Every duration is WHOLE SECONDS, never `HH:MM:SS`: the card's cast to `time`
 * silently wraps modulo 24 hours (19 of 101 operators cross that line on a
 * quarter-wide window). Rendering them as a clock is this frontend's job.
 *
 * Percents are on the 0..100 scale, both taken from `full_count`.
 *
 * Both averages are null when their denominator is zero — an operator who
 * connected nothing has no average conversation, which is not an average of
 * zero. In practice only `avg_duration_per_answered_seconds` can be null: a
 * row exists because it has calls.
 *
 * The org columns are spelled `department` / `group` here, NOT the
 * `group_name` the sibling reports use — the backend schema names them that
 * way and the wire format is the contract, so the difference is mirrored
 * rather than smoothed over on the way in.
 */
export interface OutboundCallsReportRow {
  user_id: number | null
  fio: string | null
  sip: string
  full_count: number
  env_count: number
  answer_count: number
  answer_percent: number
  quality_count: number
  quality_percent: number
  answer_duration_seconds: number
  quality_duration_seconds: number
  avg_duration_per_call_seconds: number | null
  avg_duration_per_answered_seconds: number | null
  department: string | null
  group: string | null
}

/**
 * Response payload. `date_start`/`date_end`/`timezone` echo the effective
 * window; `rows` come pre-sorted by `full_count` descending, then `fio`, then
 * `sip` (seats the directory does not know last) and are never re-sorted here.
 *
 * There is no pagination: 83 operators dialled in August 2026 and the whole
 * directory holds 379 extensions.
 */
export interface OutboundCallsReportResponse {
  project_id: number
  date_start: string
  date_end: string
  timezone: string
  rows: OutboundCallsReportRow[]
  generated_at: string
}
