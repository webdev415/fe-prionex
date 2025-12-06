/**
 * Role & Permissions Types
 *
 * TypeScript types for role/permission API responses and requests.
 */

/**
 * Permission definition
 */
export interface Permission {
  id: number
  code: string
  name: string
  description?: string
  category: string
}

/**
 * Role from API
 */
export interface ApiRole {
  id: number
  project_id: number
  name: string
  description?: string
  is_default: boolean
  is_active: boolean
  permission_count: number
  user_count: number
  permissions?: Permission[] // Only available in detail view
  created_at: string
  updated_at: string
}

/**
 * Paginated role list response
 */
export interface RoleListResponse {
  roles: ApiRole[]
  pagination: {
    page: number
    page_size: number
    total_count: number
    total_pages: number
  }
}

/**
 * Role list query parameters
 */
export interface RoleListParams {
  page?: number
  page_size?: number
  project_id?: number
  is_active?: boolean
  search?: string
  ordering?: string
}

/**
 * Create role input
 */
export interface CreateRoleInput {
  project_id: number
  name: string
  description?: string
  permission_ids: number[]
}

/**
 * Update role input
 */
export interface UpdateRoleInput {
  name: string
  description?: string
  permission_ids: number[]
}

/**
 * Role detail response
 */
export interface RoleDetailResponse extends ApiRole {
  user_count?: number
}

/**
 * Available permissions response
 */
export interface PermissionsResponse {
  permissions: Permission[]
}
