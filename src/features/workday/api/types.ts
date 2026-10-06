/**
 * Workday Report API Types
 *
 * Backend contract for the «Робочий день з розривами» / «Робочий місяць з
 * розривами» reports (client-service, migrated Metabase Cards 73 + 74 and the
 * Techno-Finance «KPI > Факторинг» pages):
 *
 *   GET /api/v1/clients/reports/workday
 *   GET /api/v1/clients/reports/workday/{user_id}/breaks
 *   GET /api/v1/clients/reports/workmonth
 *   GET /api/v1/clients/reports/workmonth/{user_id}/days
 *
 * Conventions shared with the sibling report endpoints:
 * - every duration is WHOLE SECONDS (`*_seconds`), rounded once on the server
 *   from unrounded values; minutes and hours are this frontend's job, so a sum
 *   of rounded per-break minutes can differ from the total by 1–2 minutes;
 * - every timestamp is an absolute UTC instant (`…Z`); the calendar day is
 *   ALWAYS Kyiv's, and `timezone` in the answer is the zone to render clock
 *   times in (`Europe/Kyiv`), whatever zone the request carried;
 * - averages are null when their denominator is zero;
 * - rows arrive sorted by the server (`department_name`, `group_name` with
 *   null last, `fio`, `user_id`) and are never re-sorted here;
 * - `is_red` is DECIDED by the server on unrounded seconds; the threshold in
 *   `meta` is for the legend only — never re-derive the colour from it.
 */

/** Which window the call metrics of the day report cover. */
export type WorkdayCallsMode = 'day' | 'cumulative'

/** Org fields every row (and both modal headers) carry. */
export interface WorkdayOperatorOrg {
  user_id: number
  fio: string
  /** false = dismissed; the department/group are the CURRENT ones for every day. */
  is_active: boolean
  department_id: number
  department_name: string
  /** Null together when the operator is in no group. */
  group_id: number | null
  group_name: string | null
}

/** Shared part of `meta` in every answer. */
export interface WorkdayMetaBase {
  config_hash: string
  algorithm_version: number
  /** A pause counts as a break when it is STRICTLY longer than this. */
  break_threshold_seconds: number
  /** Red when the (unrounded) break sum — or, for a month, average — exceeds this. */
  red_threshold_seconds: number
  lunch_deduction_seconds: number
  /**
   * First day with complete history (`WORKDAY_HISTORY_FROM`), agreed for PR 6
   * on 06.10.2026. Optional until the backend ships it — the pickers fall back
   * to the frontend constant (`utils/limits.ts`).
   */
  history_from?: string
}

/** Present only in the list answers (`/workday`, `/workmonth`). */
export interface WorkdayMetaDepartments {
  department_ids: number[]
  departments_not_found: number[]
}

// ---------------------------------------------------------------------------
// GET /workday
// ---------------------------------------------------------------------------

export interface WorkdayReportParams {
  project_id: number
  /** YYYY-MM-DD, a Kyiv calendar day; REQUIRED by the backend. */
  day: string
  calls?: WorkdayCallsMode
  /** Profile IANA zone — validated by the backend, moves nothing. */
  timezone?: string
}

/** Card 145 metrics, same field names as the outbound-calls report. */
export interface WorkdayCallMetrics {
  answer_count: number
  answer_duration_seconds: number
  quality_count: number
  quality_duration_seconds: number
  /** Null when `answer_count` is 0. */
  avg_duration_per_answered_seconds: number | null
}

export interface WorkdayRow extends WorkdayOperatorOrg {
  first_event_at: string
  last_event_at: string
  /** `max(0, last − first − lunch)`; partial while `meta.day_closed` is false. */
  working_seconds: number
  breaks_count: number
  breaks_total_seconds: number
  max_break_seconds: number
  is_red: boolean
  /** Null in EVERY row at once ⇔ `meta.calls_unavailable`. */
  calls: WorkdayCallMetrics | null
}

export interface WorkdayReportMeta extends WorkdayMetaBase, WorkdayMetaDepartments {
  source: 'snapshot' | 'live'
  /** false for today: the day is still running and the numbers are partial. */
  day_closed: boolean
  calls_from: string
  calls_to: string
  calls_unavailable: boolean
}

export interface WorkdayReportResponse {
  project_id: number
  day: string
  calls: WorkdayCallsMode
  timezone: string
  rows: WorkdayRow[]
  meta: WorkdayReportMeta
  generated_at: string
}

// ---------------------------------------------------------------------------
// GET /workday/{user_id}/breaks
// ---------------------------------------------------------------------------

export interface WorkdayBreaksParams {
  project_id: number
  day: string
  timezone?: string
}

export type WorkdayEventSource = 'ta' | 'audit' | 'call'

/**
 * One side of a break. A `call` label CONTAINS THE CUSTOMER'S PHONE NUMBER
 * (`"outbound → 380…: answered"`; «—» once older than the retention window),
 * so a label is rendered only as text inside `data-openreplay-obscured` and
 * never in an attribute.
 */
export interface WorkdayBreakEvent {
  source: WorkdayEventSource
  label: string
}

export interface WorkdayBreak {
  start_at: string
  end_at: string
  duration_seconds: number
  before: WorkdayBreakEvent
  after: WorkdayBreakEvent
}

export interface WorkdayBreaksResponse extends WorkdayOperatorOrg {
  project_id: number
  day: string
  timezone: string
  /** Null (with zeros and no breaks) for an operator without activity that day. */
  first_event_at: string | null
  last_event_at: string | null
  working_seconds: number
  breaks_count: number
  breaks_total_seconds: number
  max_break_seconds: number
  is_red: boolean
  breaks: WorkdayBreak[]
  meta: WorkdayMetaBase & { source: 'snapshot' | 'live'; day_closed: boolean }
  generated_at: string
}

// ---------------------------------------------------------------------------
// GET /workmonth
// ---------------------------------------------------------------------------

export interface WorkmonthReportParams {
  project_id: number
  /** YYYY-MM */
  month: string
  timezone?: string
}

/** Month totals — over the days that count (weekdays, minus holidays if excluded). */
export interface WorkmonthTotals {
  total_working_seconds: number
  total_breaks_count: number
  total_breaks_seconds: number
  max_break_seconds: number
  days_with_activity: number
  /** Null when `days_with_activity` is 0 (rendered «—», not 0). */
  average_breaks_seconds: number | null
  /** Average break time per active day > `meta.red_threshold_seconds` (TF parity). */
  is_red: boolean
}

export interface WorkmonthRow extends WorkdayOperatorOrg, WorkmonthTotals {}

export interface WorkmonthMeta extends WorkdayMetaBase {
  source: 'snapshot' | 'live' | 'mixed' | null
  live_days: string[]
  /** «Робочих днів: N» context, NOT the divisor of the average. */
  weekdays_in_period: number
  holidays: string[]
  holidays_excluded: boolean
  /** The holiday calendar did not answer: `is_holiday` flags are all false. */
  holidays_unavailable: boolean
}

export interface WorkmonthReportResponse {
  project_id: number
  month: string
  timezone: string
  /** Both null when the window is empty (a future month, or the 1st of the current one). */
  window_from: string | null
  window_to: string | null
  rows: WorkmonthRow[]
  meta: WorkmonthMeta & WorkdayMetaDepartments
  generated_at: string
}

// ---------------------------------------------------------------------------
// GET /workmonth/{user_id}/days
// ---------------------------------------------------------------------------

export interface WorkmonthDaysParams {
  project_id: number
  month: string
  timezone?: string
}

/** One calendar day of the month (EVERY day 1..last is present). */
export interface WorkmonthDay {
  day: string
  /** 1 = Monday … 7 = Sunday. */
  iso_weekday: number
  is_weekend: boolean
  is_holiday: boolean
  counts_in_totals: boolean
  /** false for today and later (and before the history start). */
  in_window: boolean
  has_activity: boolean
  first_event_at: string | null
  last_event_at: string | null
  /** 0 in the window without activity; null outside the window. */
  working_seconds: number | null
  breaks_count: number | null
  breaks_total_seconds: number | null
  max_break_seconds: number | null
  is_red: boolean | null
  source: 'snapshot' | 'live' | null
  computed_at: string | null
}

export interface WorkmonthDaysResponse extends WorkdayOperatorOrg {
  project_id: number
  month: string
  timezone: string
  window_from: string | null
  window_to: string | null
  /** The same numbers as this operator's `/workmonth` row. */
  totals: WorkmonthTotals
  days: WorkmonthDay[]
  meta: WorkmonthMeta
  generated_at: string
}
