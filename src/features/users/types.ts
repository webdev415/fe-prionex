/**
 * User Management API Types
 *
 * Type definitions for user CRUD operations based on auth-service API.
 * Matches the backend API specifications from requirements document.
 */

/**
 * Project role assignment (for responses)
 */
export interface ProjectRole {
  project_id: number
  project_name: string
  role_id: number
  role_name: string
  department_id?: number | null
  department_name?: string | null
  group_id?: number | null
  group_name?: string | null
}

/**
 * Project role assignment (for requests)
 */
export interface ProjectRoleAssignment {
  project_id: number
  role_id: number
  group_id?: number
}

/**
 * User entity from API responses
 */
export interface ApiUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  middle_name?: string
  phone?: string
  language: 'uk' | 'en'
  timezone: string
  status: 'active' | 'inactive' | 'suspended'
  must_change_password: boolean
  last_login_at?: string
  failed_login_attempts: number
  locked_until?: string
  created_at: string
  updated_at?: string
  projects?: ProjectRole[]
  asterisk_extension?: string
  is_agent: boolean
  agent_status?: 'online' | 'offline' | 'busy' | 'on-call'
  two_factor_enabled: boolean
  // True when the user has previously enrolled — admin can re-enable without re-enrollment.
  two_factor_has_secret: boolean
}

/**
 * User list query parameters
 */
export type UserSearchField = 'full_name' | 'username' | 'email' | 'extension'

/** Status filter values shown in the User Management filter panel */
export type UserStatusFilter = 'all' | 'active' | 'disabled'

export type UserSortField =
  | 'id'
  | 'username'
  | 'full_name'
  | 'email'
  | 'project_role'
  | 'extension'
  | 'status'
export type UserSortOrder = 'asc' | 'desc'

export interface UserListParams {
  page?: number
  page_size?: number
  status?: 'active' | 'inactive' | 'suspended'
  search?: string
  search_field?: UserSearchField
  role_id?: number
  project_id?: number
  department_id?: number
  group_id?: number
  sort_by?: UserSortField
  sort_order?: UserSortOrder
}

/**
 * Paginated user list response
 */
export interface UserListResponse {
  users: ApiUser[]
  pagination: {
    page: number
    page_size: number
    total_count: number
    total_pages: number
  }
}

/**
 * Create user input (POST /api/v1/admin/users)
 */
export interface CreateUserInput {
  username: string
  email: string
  password: string
  first_name: string
  last_name: string
  middle_name?: string
  phone?: string
  language: 'uk' | 'en'
  timezone: string
  must_change_password: boolean
  project_assignments: ProjectRoleAssignment[]
  asterisk_extension?: string
  is_agent?: boolean
}

/**
 * Update user input (PUT /api/v1/admin/users/:id)
 */
export interface UpdateUserInput {
  email?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  phone?: string
  language?: 'uk' | 'en'
  timezone?: string
  status?: 'active' | 'inactive' | 'suspended'
  project_assignments?: ProjectRoleAssignment[]
  asterisk_extension?: string
  is_agent?: boolean
}

/**
 * Reset password response
 */
export interface ResetPasswordResponse {
  success: boolean
  message: string
  temporary_password: string
}

/**
 * Unlock account response
 */
export interface UnlockAccountResponse {
  success: boolean
  message: string
  username: string
  unlocked_by: string
}

/**
 * User detail with project assignments
 */
export interface UserDetailResponse extends ApiUser {
  projects?: ProjectRole[]
}
