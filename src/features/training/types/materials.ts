/** KAN-499 — Training Materials Library types.
 *
 * Mirrors the Pydantic schemas in
 * `api-prionex/services/quality/app/schemas/materials.py`. Materials are
 * trainer-uploaded files (PDF / DOCX / video / audio) stored on local disk;
 * the row carries metadata + a server-side `storage_key` (never exposed).
 */

export type MaterialType = 'pdf' | 'docx' | 'video' | 'audio' | 'other'

/** Coarse chip categories the grid filters on (excludes the catch-all). */
export const MATERIAL_TYPES: readonly Exclude<MaterialType, 'other'>[] = [
  'pdf',
  'docx',
  'video',
  'audio',
]

export interface Material {
  id: number
  project_id: number
  uploaded_by_user_id: number
  title: string
  description: string | null
  mime_type: string
  size_bytes: number
  original_filename: string
  category_id: number | null
  tags: string[] | null
  created_at: string
  updated_at: string
  /** Derived server-side from `mime_type`. */
  type: MaterialType
}

export interface MaterialListResponse {
  data: Material[]
  total: number
}

export interface MaterialListFilters {
  category?: number
  type?: MaterialType
  q?: string
  limit?: number
  offset?: number
}

export interface MaterialUploadPayload {
  file: File
  title?: string
  description?: string
  category_id?: number | null
  tags?: string[]
}

export interface MaterialUpdatePayload {
  title?: string
  description?: string | null
  category_id?: number | null
  tags?: string[]
}

export interface MaterialCategory {
  id: number
  project_id: number
  name: string
  slug: string
  created_at: string
}
