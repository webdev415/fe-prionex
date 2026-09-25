export interface DocumentType {
  id: number
  project_id: number
  name: string
  color: string
  is_hidden: boolean
  doc_count: number
  /** Bulk-upload rules and folder defaults pointing at this type. */
  rule_count: number
  created_at: string
  updated_at: string
}

export interface DocumentTypeCreate {
  name: string
  color: string
}

export interface DocumentTypeUpdate {
  name?: string
  color?: string
}

export interface DocumentTypeVisibilityUpdate {
  is_hidden: boolean
}
