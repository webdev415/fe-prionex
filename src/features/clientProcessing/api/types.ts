/**
 * Client Processing Report API Types
 *
 * Backend contract for GET /api/v1/clients/reports/processing
 * (client-service, "Відпрацювання за ЦД" report).
 */

/**
 * Query params in backend (snake_case) format.
 * Both dates are required together — the backend answers 400 when only one is set.
 */
export interface ProcessingReportParams {
  project_id: number
  date_start: string // YYYY-MM-DD
  date_end: string // YYYY-MM-DD
}

/**
 * Per-employee aggregate of assigned vs processed clients.
 *
 * All `percent_*` fields arrive on the 0..100 percent scale (NOT 0..1
 * fractions — the scale is fixed in the backend contract). They are typed
 * nullable defensively: the UI renders "—" without a gradient fill for
 * missing values.
 */
export interface ProcessingReportRow {
  employee_id: number
  full_name: string
  department_id: number | null
  department_name: string | null
  group_id: number | null
  group_name: string | null
  count_client: number
  count_processed: number
  count_processed_client: number
  count_processed_contact: number
  percent_processed: number | null
  percent_processed_client: number | null
  percent_processed_contact: number | null
}

/** Response payload; `rows` come pre-sorted by employee full name. */
export interface ProcessingReportResponse {
  project_id: number
  date_start: string
  date_end: string
  rows: ProcessingReportRow[]
  generated_at: string
}
