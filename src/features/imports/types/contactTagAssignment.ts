/**
 * Types for the Contact Tags bulk import.
 *
 * File format: `tin, contact_value, category, tag`. The tag cell may carry
 * several comma-separated values, all belonging to the category named in the
 * same row, so one row describes one (contact, category) pair.
 *
 * Mirrors `services/import/app/schemas/contact_tag_assignment.py`.
 */

/**
 * `system` is deliberately distinct from `protected`: a system category is
 * rejected for everyone regardless of permissions, so labelling it a permission
 * failure would send an operator chasing access that does not exist.
 */
export type ContactTagRowStatus =
  | 'ready'
  | 'no_change'
  | 'contact_not_found'
  | 'tag_not_found'
  | 'protected'
  | 'system'
  | 'multiple_values_single_select'
  | 'duplicate'
  | 'invalid'

export type ContactTagAssignmentMode = 'assign' | 'remove'

export interface ContactTagPreviewRow {
  row_number: number
  tin: string
  contact_value: string
  category: string
  tag_names: string[]

  client_id: number | null
  client_name: string | null
  category_id: number | null
  selection_type: string | null

  /**
   * One row can resolve to several contact records under the same client (the
   * same number stored as own mobile / recommender / third party), so the tag
   * fans out over every match. `matched_contacts` is what the operator needs to
   * see: 1,000 rows can mean ~7,000 writes.
   */
  contact_ids: number[]
  matched_contacts: number

  tag_value_ids: number[]
  unknown_tag_names: string[]

  /**
   * Single-select assign REPLACES whatever is on the contact. Read at preview
   * time, so it is a snapshot: worded "currently", never "will replace",
   * because execute can be up to 30 minutes later.
   */
  currently_assigned: string[]
  replaces_existing: boolean

  status: ContactTagRowStatus
  error: string | null
  severity: string | null
}

export interface ContactTagPreviewSummary {
  total_rows: number
  ready: number
  no_change: number
  invalid: number
  /** Rows discarded because a later row named the same (contact, category). */
  duplicates_overridden: number
  unique_contacts: number
  unique_categories: number
  /** Rows and writes differ because of fan-out; both are reported. */
  contacts_affected: number
}

export interface ContactTagAssignmentPreviewResponse {
  job_id: number
  batch_id: string
  filename: string
  status: string
  mode: ContactTagAssignmentMode
  total_records: number
  summary: ContactTagPreviewSummary
  preview_rows: ContactTagPreviewRow[]
  errors: ContactTagPreviewRow[]
  /** Non-fatal notices, e.g. "only the first worksheet was read". */
  warnings: string[]
}

export interface ContactTagExecuteRequest {
  skip_warnings?: boolean
}

export interface ContactTagExecuteResponse {
  job_id: number
  status: string
  message: string
}
