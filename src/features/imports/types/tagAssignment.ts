/**
 * Types for Bulk Tag Assignment / Removal CSV Import feature.
 */

export type TagRowStatus = 'ready' | 'no_change' | 'error' | 'warning'

export type TagAssignmentMode = 'assign' | 'remove'

export interface TagPreviewRow {
  row_number: number
  tax_id: string
  client_id: number | null
  client_name: string | null
  tag_names: string[]
  unknown_tag_names: string[]
  /**
   * REMOVE-mode partitioning of protected tags.
   * ``protected_allowed_names``: protected tags the uploader CAN remove
   * (their role is in the tag's protected_removal_roles).
   * ``protected_blocked_names``: protected tags the uploader CANNOT
   * remove. Both empty in ASSIGN mode and when no protected tags are in
   * the row.
   */
  protected_allowed_names: string[]
  protected_blocked_names: string[]
  status: TagRowStatus
  error: string | null
  severity: string | null
}

export interface TagPreviewSummary {
  ready: number
  no_change: number
  invalid: number
  unique_tags: number
  unique_clients: number
}

export interface TagPreviewResponse {
  job_id: number
  batch_id: string
  filename: string
  status: string
  mode: TagAssignmentMode
  total_records: number
  summary: TagPreviewSummary
  preview_rows: TagPreviewRow[]
  errors: TagPreviewRow[]
}

export interface TagExecuteRequest {
  skip_warnings?: boolean
}

export interface TagExecuteResponse {
  job_id: number
  status: string
  message: string
}
