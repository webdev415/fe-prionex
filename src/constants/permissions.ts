/**
 * Permission Constants
 *
 * Centralized permission definitions that match the backend RBAC system.
 * These permissions control access to features, routes, and UI elements.
 *
 * Backend Source: /home/pst/dev/prionex/api-prionex/services/auth/alembic/versions/20251122_0002_002_seed_initial_data.py
 * Total Permissions: 34 (26 pre-existing + 8 seller/scoring config permissions)
 */

export const PERMISSIONS = {
  /**
   * Clients Category (4 permissions)
   * Controls access to client data and management
   */
  CLIENTS: {
    VIEW: 'view_clients',
    EDIT: 'edit_clients',
    EDIT_DEBT: 'edit_debt',
    DELETE: 'delete_clients',
  },

  /**
   * Communication Category (3 permissions)
   * Controls access to calling and messaging features
   */
  COMMUNICATION: {
    MAKE_CALLS: 'make_calls',
    SEND_SMS: 'send_sms',
    VIEW_CALL_HISTORY: 'view_call_history',
  },

  /**
   * Reports Category (3 permissions)
   * Controls access to statistics and reporting
   */
  REPORTS: {
    VIEW_OWN_STATS: 'view_own_stats',
    VIEW_TEAM_STATS: 'view_team_stats',
    VIEW_ALL_REPORTS: 'view_all_reports',
  },

  /**
   * Data Category (3 permissions)
   * Controls access to data import/export and manual priority
   */
  DATA: {
    IMPORT_DATA: 'import_data',
    EXPORT_DATA: 'export_data',
    MANUAL_PRIORITY: 'manual_priority',
  },

  /**
   * Users Category (5 permissions)
   * Controls access to user management
   */
  USERS: {
    VIEW: 'view_users',
    CREATE: 'create_users',
    EDIT: 'edit_users',
    DELETE: 'delete_users',
    IMPERSONATE: 'impersonate_users',
  },

  /**
   * System Category (3 permissions)
   * Controls access to system administration
   */
  SYSTEM: {
    MANAGE_SETTINGS: 'manage_settings',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_ROLES: 'manage_roles',
  },

  /**
   * Projects Category (1 permission)
   * Controls access to project management
   * Note: Projects are admin-only (requires manage_projects)
   */
  PROJECTS: {
    MANAGE: 'manage_projects',
  },

  /**
   * Tags Category (4 permissions)
   * Controls access to tag management
   * Note: Tags are admin-only
   */
  TAGS: {
    VIEW: 'view_tags',
    CREATE: 'create_tags',
    EDIT: 'edit_tags',
    DELETE: 'delete_tags',
  },

  /**
   * Sellers Category (4 permissions)
   * Controls access to seller/creditor management
   * Note: View permissions restricted to Admin and Supervisor
   */
  SELLERS: {
    VIEW: 'view_sellers',
    CREATE: 'create_sellers',
    EDIT: 'edit_sellers',
    DELETE: 'delete_sellers',
  },

  /**
   * Scoring Configuration Category (4 permissions)
   * Controls access to scoring algorithm configuration
   * Note: View permissions restricted to Admin and Supervisor
   */
  SCORING_CONFIG: {
    VIEW: 'view_scoring_config',
    EDIT: 'edit_scoring_config',
    MANAGE_SELLER_CONFIG: 'manage_seller_config',
    VIEW_HISTORY: 'view_config_history',
  },
} as const

/**
 * Utility type to extract all nested string values from PERMISSIONS object
 * Automatically includes all permission codes without manual listing
 * Provides full TypeScript autocomplete and compile-time type checking
 */
type NestedPermissionValues<T> = T extends object
  ? { [K in keyof T]: NestedPermissionValues<T[K]> }[keyof T]
  : T

/**
 * Type-safe permission string
 * IDE will autocomplete valid permission codes
 * TypeScript will error on invalid permission strings
 */
export type Permission = NestedPermissionValues<typeof PERMISSIONS>

/**
 * Helper to get all permission values as an array
 * Useful for validation and testing
 */
export function getAllPermissions(): Permission[] {
  const permissions: Permission[] = []

  Object.values(PERMISSIONS).forEach((category) => {
    Object.values(category).forEach((permission) => {
      permissions.push(permission as Permission)
    })
  })

  return permissions
}

/**
 * Permission category names for grouping in UI
 */
export const PERMISSION_CATEGORIES = {
  CLIENTS: 'Clients',
  COMMUNICATION: 'Communication',
  REPORTS: 'Reports',
  DATA: 'Data',
  USERS: 'Users',
  SYSTEM: 'System',
  PROJECTS: 'Projects',
  TAGS: 'Tags',
  SELLERS: 'Sellers',
  SCORING_CONFIG: 'Scoring Configuration',
} as const

/**
 * Permission descriptions for display in UI
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Clients
  view_clients: 'View client data and information',
  edit_clients: 'Edit client information (except debt amounts)',
  edit_debt: 'Edit debt amounts and DPD (Days Past Due)',
  delete_clients: 'Delete client records (soft delete)',

  // Communication
  make_calls: 'Make outbound phone calls to clients',
  send_sms: 'Send SMS messages to clients',
  view_call_history: 'View call recordings and SMS history',

  // Reports
  view_own_stats: 'View own performance statistics',
  view_team_stats: 'View team performance statistics',
  view_all_reports: 'View all system reports and analytics',

  // Data
  import_data: 'Import client data from files',
  export_data: 'Export client and system data',
  manual_priority: 'Manually change client contact priority',

  // Users
  view_users: 'View user accounts',
  create_users: 'Create new user accounts',
  edit_users: 'Edit user accounts and assignments',
  delete_users: 'Deactivate user accounts',
  impersonate_users: 'View application as another user',

  // System
  manage_settings: 'Configure system settings',
  view_audit_logs: 'View system audit logs',
  manage_roles: 'Create and edit roles and permissions',

  // Projects
  manage_projects: 'Create, update, archive and restore projects',

  // Tags
  view_tags: 'View tags',
  create_tags: 'Create new tags',
  edit_tags: 'Edit existing tags',
  delete_tags: 'Delete tags',

  // Sellers
  view_sellers: 'View seller/creditor list and details',
  create_sellers: 'Create new sellers/creditors',
  edit_sellers: 'Edit seller/creditor information',
  delete_sellers: 'Deactivate sellers/creditors',

  // Scoring Configuration
  view_scoring_config: 'View scoring configuration and thresholds',
  edit_scoring_config: 'Update scoring weights and priority thresholds',
  manage_seller_config: 'Manage seller-specific scoring configurations',
  view_config_history: 'View scoring configuration change history',
}
