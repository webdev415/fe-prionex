/**
 * Project Management Types
 *
 * TypeScript types for project API responses and requests.
 */

/**
 * Project from API
 */
export interface ApiProject {
  id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  settings?: Record<string, unknown>
  user_count?: number
  role_count?: number
  created_at: string
  updated_at: string
  created_by?: {
    id: number
    username: string
  } | null
}

/**
 * Paginated project list response
 */
export interface ProjectListResponse {
  projects: ApiProject[]
  pagination: {
    page: number
    page_size: number
    total_items: number
    total_pages: number
  }
}

/**
 * Project list query parameters
 */
export interface ProjectListParams {
  page?: number
  page_size?: number
  search?: string
  status?: 'active' | 'archived' | 'all'
  ordering?: string
}

/**
 * Create project input
 */
export interface CreateProjectInput {
  name: string
  code: string
  description?: string
}

/**
 * Update project input
 */
export interface UpdateProjectInput {
  name: string
  code: string
  description?: string
}

/**
 * Project detail response (may include additional data)
 */
export type ProjectDetailResponse = ApiProject
