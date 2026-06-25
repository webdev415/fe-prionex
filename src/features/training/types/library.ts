/** KAN-411 Feature 3.4 — training call library types.
 *
 * Mirrors the Pydantic schemas in
 * `api-prionex/services/quality/app/schemas/library.py`. The library is
 * the curated corpus of teaching calls; rows are either trainer-created
 * or auto-inserted by the `marker.added_to_library` flow.
 */

export type LibraryCategory = 'ideal' | 'mistake' | 'complex' | 'non_standard'

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = [
  'ideal',
  'mistake',
  'complex',
  'non_standard',
]

export interface LibraryCallCard {
  id: number
  project_id: number
  marker_id: number | null
  call_id: string
  category: LibraryCategory
  title: string
  description: string | null
  tags: string[]
  added_by_user_id: number
  created_at: string
  updated_at: string
  view_count: number
  helpful_count: number
  /** Per-viewer state — null when the endpoint doesn't compute it. */
  voted_helpful: boolean | null
}

export interface LibraryCallListResponse {
  data: LibraryCallCard[]
  total: number
}

export interface LibraryCallListFilters {
  category?: LibraryCategory
  tag?: string[]
  q?: string
  from_date?: string
  to_date?: string
  limit?: number
  offset?: number
}

export interface LibraryCallCreatePayload {
  call_id: string
  category?: LibraryCategory
  title: string
  description?: string | null
  tags?: string[]
  marker_id?: number | null
}

export interface LibraryCallUpdatePayload {
  category?: LibraryCategory
  title?: string
  description?: string | null
  tags?: string[]
}

export interface LibraryHelpfulToggleResponse {
  library_call_id: number
  voted_helpful: boolean
  helpful_count: number
}

export interface LibraryTagsResponse {
  tags: string[]
}
