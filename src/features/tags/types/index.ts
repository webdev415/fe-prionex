/**
 * Tags Feature Types
 *
 * Type definitions for tags domain
 */

export interface Tag {
  id: number
  name: string
  color: string
  description?: string
  project_id: number
  project_name?: string
  client_count?: number
  created_at: string
}

export interface TagCreate {
  name: string
  color: string
  description?: string
}

export interface TagUpdate {
  name?: string
  color?: string
  description?: string
}

export interface TagsListResponse {
  tags: Tag[]
  total_count: number
}
