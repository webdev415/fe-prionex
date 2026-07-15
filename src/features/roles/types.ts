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
  /** Per-tab access depth (KAN-757); 'all' for non-tab permissions. */
  access_level?: string
}

/**
 * Role from API
 */
export interface ApiRole {
  id: number
  project_id: number
  name: string
  description?: string
  department_id?: number | null
  department_name?: string | null
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
  department_id?: number | null
  permission_ids: number[]
  /** Per-tab access depth keyed by permission_id (KAN-757). */
  access_levels?: Record<number, string>
}

/**
 * Update role input
 * All fields are optional to match backend UpdateRoleRequest
 */
export interface UpdateRoleInput {
  name?: string
  description?: string
  department_id?: number | null
  permission_ids?: number[]
  /** Per-tab access depth keyed by permission_id (KAN-757). */
  access_levels?: Record<number, string>
  is_active?: boolean
}

/**
 * Role detail response
 * Extends ApiRole but permissions are always included in detail view
 */
export interface RoleDetailResponse extends Omit<ApiRole, 'user_count'> {
  user_count: number // Required in detail response
  permissions: Permission[] // Always included in detail view
}

/**
 * Available permissions response
 */
export interface PermissionsResponse {
  permissions: Permission[]
}
