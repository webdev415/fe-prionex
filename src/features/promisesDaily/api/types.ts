/**
 * Promises Daily Report API Types
 *
 * Backend contract for GET /api/v1/clients/reports/promises-daily
 * (client-service, «Обіцянки до кінця місяця», migrated Metabase Card 103).
 * Mirrors services/client/app/schemas/promises_daily_report.py.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` are BOTH REQUIRED and inclusive (date_from <= date_to,
 * at most a 366-day difference). The tab always sends a window — today → end
 * of the current month by default, which is the report's namesake period.
 *
 * `timezone` cuts the PROMISED-date calendar days and nothing else; the
 * backend defaults to UTC when it is omitted (Europe/Kyiv reproduces the card
 * for summer dates).
 *
 * `possible_payment` widens the promise subtypes the report counts: false (the
 * backend default) covers the firm agreement results, true additionally counts
 * the «можлива» (possible) agreement subtype.
 */
export interface PromisesDailyReportParams {
  project_id: number
  date_from: string // YYYY-MM-DD, inclusive
  date_to: string // YYYY-MM-DD, inclusive
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
  /** Count the «possible payment» agreement subtype too; backend defaults to false. */
  possible_payment?: boolean
}

/**
 * One department's series over the response's day axis.
 *
 * `name` is NULLABLE — promises taken by operators with no department are a
 * real series (they carry real money) and must not be lost; the frontend
 * renders them under a localized «Без відділу» label.
 *
 * `values` is aligned index-for-index with the response's `dates` axis (one
 * amount per day, zero-days included), and `total` is the department's sum
 * over the whole window. Money is exact `Decimal` server-side and therefore
 * serialises as JSON STRINGS ("112062.00"); the union with `number` covers a
 * payload that ever ships it unquoted.
 */
export interface PromisesDailyDepartment {
  name: string | null
  values: Array<string | number>
  total: string | number
}

/**
 * Response payload.
 *
 * `dates` is a CONTINUOUS day axis over the requested window — every calendar
 * day appears whether or not any promise lands on it, so the table's rows can
 * be built straight from it. `total` is the grand total over every department
 * and every day. `generated_at` is stamped when the numbers were COMPUTED, not
 * when they were served: a computed report is re-served from a worker-local
 * cache for 15 minutes, so a hit states its own age instead of claiming to be
 * new. `timezone` and `possible_payment` echo what was actually applied.
 */
export interface PromisesDailyReportResponse {
  project_id: number
  date_from: string
  date_to: string
  timezone: string
  possible_payment: boolean
  /** Continuous YYYY-MM-DD day axis, `date_from` → `date_to` inclusive. */
  dates: string[]
  departments: PromisesDailyDepartment[]
  total: string | number
  generated_at: string
}
