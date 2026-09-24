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
  /**
   * HUB chat role chosen for this CRM role (KAN-1476). `null` = not set (HUB
   * decides by the role name), `'none'` = no HUB access, otherwise a HUB role
   * name. The key is absent on a backend that predates the field, which is how
   * the UI knows not to show it at all.
   */
  hub_role?: string | null
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
  /**
   * HUB chat role (KAN-1476). Sent only when the HUB catalogue is enabled and
   * a value was chosen - the key is never present otherwise.
   */
  hub_role?: string
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
  /**
   * HUB chat role (KAN-1476). Absent = keep the stored value (what every
   * caller that does not know about the field sends); `null` = clear it.
   */
  hub_role?: string | null
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

/**
 * How the backend's HUB_ROLE_MODE is set (KAN-1476): `off` - the field is not
 * written or sent to HUB; `emit` - stored values reach HUB but cannot be
 * changed; `on` - the values can be chosen here.
 */
export type HubRoleMode = 'off' | 'emit' | 'on'

/** One choice of the HUB chat-role catalogue. */
export interface HubRoleOption {
  code: string
  /** False when the caller may not grant (or take away) this value. */
  assignable: boolean
}

/** `GET /api/v1/admin/roles/hub-roles?project_id=` */
export interface HubRoleCatalog {
  mode: HubRoleMode
  /** Only `true` lets the UI offer the choice. */
  enabled: boolean
  options: HubRoleOption[]
}
