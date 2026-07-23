/**
 * Types for the Document Generation > Document Journal feature (KAN-403 Tab 1).
 */

import type { ClientDocument } from '@/features/clients/api/documentApi'

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

/**
 * When a template becomes selectable for generation on a client's debt.
 *   - `always`           — no precondition.
 *   - `active_debt`      — the debt must be open/active.
 *   - `closed_debt`      — the debt must be closed.
 *   - `rr_active`        — the debt has an active restructuring (RR).
 *   - `rr_first_payment` — the RR's first instalment has been paid.
 *   - `promise_active`   — the client has a live promise-to-pay.
 * The server evaluates the rule per debt and returns the verdict in
 * `GenerationTemplateDebt.available` / `.reason`.
 */
export type DocumentActivationRule =
  | 'always'
  | 'active_debt'
  | 'closed_debt'
  | 'rr_active'
  | 'rr_first_payment'
  | 'promise_active'

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
  /** Precondition that gates this template during generation. */
  activation_rule: DocumentActivationRule
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
  activation_rule?: DocumentActivationRule
}

export interface DocumentTemplateUpdatePayload {
  name?: string
  description?: string | null
  body?: string
  available_variables?: DocumentTemplateVariable[]
  is_active?: boolean
  activation_rule?: DocumentActivationRule
}

/* ------------------------------------------------------------------ */
/* Document generation from a client card                              */
/* ------------------------------------------------------------------ */

/**
 * Why a template is (un)available for a specific debt.
 *   - `ok`               — available.
 *   - `debt_not_closed`  — rule needs a closed debt, this one is open.
 *   - `debt_closed`      — rule needs an open debt, this one is closed.
 *   - `no_active_rr`     — rule needs an active restructuring, none found.
 *   - `no_active_promise`— rule needs a live promise-to-pay, none found.
 * Unknown codes are tolerated and fall back to a generic message.
 */
export type GenerationOptionReason =
  | 'ok'
  | 'debt_not_closed'
  | 'debt_closed'
  | 'no_active_rr'
  | 'no_active_promise'

export interface GenerationTemplateDebt {
  debt_id: number
  available: boolean
  reason: GenerationOptionReason | string
}

export interface GenerationTemplateOption {
  id: number
  name: string
  activation_rule: DocumentActivationRule
  /** Per-debt availability verdict for this template. */
  debts: GenerationTemplateDebt[]
}

export interface GenerationOptionsResponse {
  templates: GenerationTemplateOption[]
}

export interface GenerateDocumentPayload {
  client_id: number
  debt_id: number
  document_type_id: number
  /** Outgoing number; omit to let the server auto-assign one. */
  index_num?: number
}

export interface GenerateDocumentResponse {
  document_id: number
  document_name: string
  /** Resolved outgoing number (auto-assigned when the request omitted it). */
  index_num: number
  /** The persisted PDF row — already visible in the client's documents list. */
  pdf_document: ClientDocument
  /** Base64-encoded .docx twin the operator may download client-side. */
  docx_base64: string
}
