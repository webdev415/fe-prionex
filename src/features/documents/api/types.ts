/**
 * Types for the Document Generation > Document Journal feature (KAN-403 Tab 1).
 */

export type DocumentAction = 'uploaded' | 'generated'

export type DocumentType =
  | 'passport'
  | 'inn'
  | 'contract'
  | 'income'
  | 'outcome'
  | 'signature'
  | 'other'

export interface DocumentJournalEntry {
  id: number
  document_name: string
  document_type: string
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
  document_type?: DocumentType
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
}

export interface DocumentTemplateListResponse {
  total: number
  items: DocumentTemplate[]
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
