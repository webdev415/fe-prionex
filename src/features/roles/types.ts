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
  /**
   * Whether the role has HUB chat access (board #1621, story 2b): the `access`
   * switch of its chat set; `null` = the chat set is not filled yet. Sent by
   * the role list.
   */
  chat_access?: boolean | null
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
   * a value was chosen - the key is never present otherwise. Not sent at all
   * while the form shows the chat settings (`VITE_ROLE_CHAT_SETTINGS_ENABLED`).
   */
  hub_role?: string
  /**
   * HUB chat template the new role's chat set is copied from (board #1621).
   * Sent only when one was chosen; create only.
   */
  chat_template?: string
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
   * caller that does not know about the field sends); `null` = clear it. Not
   * sent while the form shows the chat settings (`VITE_ROLE_CHAT_SETTINGS_ENABLED`).
   */
  hub_role?: string | null
  /**
   * The eight HUB chat switches (board #1621, story 2b), all of them. Absent =
   * keep. The role form sends them only when its chat section changed.
   */
  chat_switches?: ChatSwitches
  /** HUB home screen of the role (board #1621, story 2b). Absent = keep. */
  home_plane?: string
}

/**
 * Role detail response
 * Extends ApiRole but permissions are always included in detail view
 */
export interface RoleDetailResponse extends Omit<ApiRole, 'user_count'> {
  user_count: number // Required in detail response
  permissions: Permission[] // Always included in detail view
  /**
   * The eight HUB chat switches in form order (board #1621); `null` = the
   * chat set is not filled yet.
   */
  chat_switches?: ChatSwitches | null
  /** HUB home screen of the role (board #1621). */
  home_plane?: string
  /** HUB seed role the chat set was copied from (create only); `null` = none. */
  chat_template?: string | null
  /**
   * False once the chat set, switches or screen were edited by hand: a later
   * `hub_role` change then keeps them (story 2b).
   */
  chat_set_follows_hub_role?: boolean
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
  /** Chat templates a new role can be copied from (board #1621, story 2b). */
  chat_templates?: ChatTemplateOption[]
  /** Values of `home_plane` (story 2b). */
  home_planes?: string[]
  /** Values of `chat_switches.client_dialogs` (story 2b). */
  client_dialog_values?: string[]
}

/** One chat template of the catalogue (board #1621). */
export interface ChatTemplateOption {
  code: string
  /** False when the caller may not create a role from it now. */
  assignable: boolean
}

/**
 * The eight HUB chat switches of a role (board #1621), in the form order of
 * the backend's `SWITCH_KEYS`. `client_dialogs` is one of
 * `none | my | department | all`; the rest are on/off.
 */
export interface ChatSwitches {
  access: boolean
  client_dialogs: string
  create_groups: boolean
  dept_channel_admin: boolean
  download_files: boolean
  ai_assistant: boolean
  chat_only: boolean
  lead: boolean
}
