/**
 * Bulk-upload document type rules (Settings → Document Generation).
 *
 * An archive's files are typed by these rules instead of by one type chosen
 * per upload: the first rule of the file's folder whose keyword occurs in the
 * file name wins, and the folder's default applies to everything else.
 */

/** The two folders an import archive can contain. */
export type DocumentImportFolder = 'credits' | 'users'

export const DOCUMENT_IMPORT_FOLDERS: DocumentImportFolder[] = ['credits', 'users']

/** Keywords are stored trimmed; the backend refuses anything longer. */
export const KEYWORD_MAX_LENGTH = 40

export interface DocumentImportRule {
  id: number
  /** Order, 1-based. Lower wins when several keywords match one file name. */
  position: number
  keyword: string
  document_type_id: number
}

export interface DocumentImportRuleSet {
  folder: DocumentImportFolder
  rules: DocumentImportRule[]
  /** Applied to files no keyword matches. Null until an admin picks one. */
  default_document_type_id: number | null
}

export interface DocumentImportRulesConfig {
  credits: DocumentImportRuleSet
  users: DocumentImportRuleSet
  /** False while either folder is still missing a default. */
  ready: boolean
}

export interface DocumentImportReadiness {
  ready: boolean
  missing_defaults: DocumentImportFolder[]
}

export interface DocumentImportRuleCreate {
  /** Omitted appends to the end; an occupied one shifts its neighbours down. */
  position?: number
  keyword: string
  document_type_id: number
}

export interface DocumentImportRuleUpdate {
  position?: number
  keyword?: string
  document_type_id?: number
}

/**
 * What a refused rule change carries: a message and the field it belongs to,
 * so the form can show it under that input instead of in a toast.
 */
export interface DocumentImportFieldError {
  message: string
  field?: 'keyword' | 'document_type_id' | 'position'
}
