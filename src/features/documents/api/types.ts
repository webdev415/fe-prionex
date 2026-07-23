/**
 * Types for the Document Generation > Document Journal feature (KAN-403 Tab 1).
 */

export type DocumentAction = 'uploaded' | 'generated'

export interface DocumentTypeRef {
  id: number
  name: string
  color: string
}

export interface DocumentJournalEntry {
  id: number
  document_name: string
  document_type_id: number | null
  document_type_ref: DocumentTypeRef | null
  client_id: number
  client_full_name: string
  debt_id: number | null
  debt_contract_number: string | null
  creditor_name: string | null
  action: DocumentAction
  performed_by_user_id: number | null
  created_at: string // ISO datetime
}

export interface DocumentJournalResponse {
  items: DocumentJournalEntry[]
  total: number
  page: number
  limit: number
}

export interface DocumentJournalParams {
  page?: number
  limit?: number
  /** FK to document_types. */
  document_type_id?: number
  action?: DocumentAction
  operator_id?: number
  /** ILIKE on client first/last/middle name. */
  client_search?: string
  /** ILIKE on contract_number (credit id) or creditor name. */
  creditor_search?: string
  date_from?: string // ISO datetime
  date_to?: string // ISO datetime
}

/* ------------------------------------------------------------------ */
/* KAN-403 Tab 2 — Document Templates                                  */
/* ------------------------------------------------------------------ */

export interface DocumentTemplateVariable {
  name: string
  required: boolean
}

/**
 * `text`  — the body is authored in-app (Textarea) and stored as plain text.
 * `docx`  — the body is derived from an uploaded .docx file; it is read-only
 *           in the UI and re-scanned server-side whenever the file changes.
 */
export type DocumentTemplateKind = 'text' | 'docx'

export interface DocumentTemplate {
  id: number
  name: string
  description: string | null
  body: string
  available_variables: DocumentTemplateVariable[] | null
  project_id: number | null
  is_active: boolean
  times_used: number
  last_used_at: string | null
  created_at: string
  updated_at: string
  /** How the body is produced/stored — see DocumentTemplateKind. */
  template_kind: DocumentTemplateKind
  /** Original filename of the uploaded .docx (null for text templates). */
  file_name: string | null
  /** Size of the uploaded .docx in bytes (null for text templates). */
  file_size: number | null
}

/**
 * Returned by the upload / replace-file endpoints. Same shape as a template
 * plus the placeholders found in the file that are NOT in the variable
 * dictionary. These are still persisted into `available_variables`; the list
 * is a *warning* (typos / unsupported vars), not an error.
 */
export interface DocumentTemplateUploadResponse extends DocumentTemplate {
  unknown_variables: string[]
}

export interface DocumentTemplateListResponse {
  total: number
  items: DocumentTemplate[]
}

/* ------------------------------------------------------------------ */
/* Variable dictionary (server-driven; replaces the old hardcoded list) */
/* ------------------------------------------------------------------ */

export interface TemplateVariableDefinition {
  name: string
  /** Bucket id — one of TemplateVariablesResponse.groups. */
  group: string
  /** Localised human label, keyed by language code (e.g. { uk, en }). */
  labels: Record<string, string>
  /** Example value used by the live preview of text templates. */
  sample: string
  /** Free-text aliases a lawyer might type in Word; informational only. */
  aliases: string[]
}

export interface TemplateVariablesResponse {
  /** Group ids in the order they should be rendered. */
  groups: string[]
  items: TemplateVariableDefinition[]
}

export interface DocumentTemplateCreatePayload {
  name: string
  description?: string | null
  body: string
  available_variables?: DocumentTemplateVariable[]
  project_id?: number
}

export interface DocumentTemplateUpdatePayload {
  name?: string
  description?: string | null
  body?: string
  available_variables?: DocumentTemplateVariable[]
  is_active?: boolean
}
