/** KAN-499 — Training Materials Library types.
 *
 * Mirrors the Pydantic schemas in
 * `api-prionex/services/quality/app/schemas/materials.py`. Materials are
 * trainer-uploaded files (PDF / DOCX / video / audio) stored on local disk;
 * the row carries metadata + a server-side `storage_key` (never exposed).
 */

export type MaterialType = 'pdf' | 'docx' | 'video' | 'audio' | 'link' | 'other'

/** A material is either an uploaded file or a link (KAN-1049). */
export type MaterialKind = 'file' | 'link'

/** Surfaces a library material can be attached to. Mirrors the CHECK on
 *  `material_attachments.target_type` — change both together. */
export type MaterialAttachmentTarget = 'course' | 'group_training' | 'one_on_one'

/** Coarse chip categories the grid filters on (excludes the catch-all). */
export const MATERIAL_TYPES: readonly Exclude<MaterialType, 'other'>[] = [
  'pdf',
  'docx',
  'video',
  'audio',
  'link',
]

/** Types that can be previewed inline in the browser (PDF, video). */
export function isPreviewable(type: MaterialType): boolean {
  return type === 'pdf' || type === 'video'
}

/** A link is opened, never downloaded: there is no file behind it, and the
 *  download endpoint answers 409 rather than streaming one. */
export function isLink(material: Pick<Material, 'kind'>): boolean {
  return material.kind === 'link'
}

export interface Material {
  id: number
  project_id: number
  uploaded_by_user_id: number
  title: string
  description: string | null
  kind: MaterialKind
  /** Set on a link, null on a file. */
  url: string | null
  /** Null on a link — there is no file to describe. */
  mime_type: string | null
  size_bytes: number | null
  original_filename: string | null
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

export interface MaterialCallAttachment {
  id: number
  material_id: number
  call_id: string
  attached_by_user_id: number
  created_at: string
}

export interface MaterialLinkPayload {
  title: string
  url: string
  description?: string | null
  category_id?: number | null
  tags?: string[] | null
}

export interface MaterialAttachment {
  id: number
  project_id: number
  material_id: number
  target_type: MaterialAttachmentTarget
  target_id: number
  attached_by_user_id: number
  created_at: string
}

/** What a material's secondary line shows: a file has a size, a link has a host.
 *  Kept beside the type so the two surfaces that render materials cannot drift. */
export function materialSubtitle(material: Material): string {
  if (material.kind === 'link') {
    try {
      return new URL(material.url ?? '').host
    } catch {
      return ''
    }
  }
  const bytes = material.size_bytes ?? 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/**
 * Open a link material, or report why it cannot be opened.
 *
 * Returns false when the stored url does not survive `safeHttpUrl` — a legacy
 * row, or a value that reached the column by some path other than the validated
 * endpoint. The caller must say something: a button that looks live and does
 * nothing is worse than an error.
 */
export function openMaterialLink(
  material: Pick<Material, 'url'>,
  safe: (raw: unknown) => string | undefined
): boolean {
  const href = safe(material.url)
  if (!href) return false
  window.open(href, '_blank', 'noopener,noreferrer')
  return true
}
