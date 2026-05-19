/**
 * Permission Constants
 *
 * Centralized permission definitions that match the backend RBAC system.
 * These permissions control access to features, routes, and UI elements.
 *
 * Backend Source: /home/pst/dev/prionex/api-prionex/services/auth/alembic/versions/20251122_0002_002_seed_initial_data.py
 * Total Permissions: 43
 */

export const PERMISSIONS = {
  /**
   * Clients Category (9 permissions)
   * Controls access to client data and management
   */
  CLIENTS: {
    VIEW: 'view_clients',
    VIEW_FULL_CLIENT_DATA: 'view_full_client_data',
    EDIT: 'edit_clients',
    ASSIGN_TAGS: 'assign_client_tags',
    EDIT_DEBT: 'edit_client_debt',
    CLOSE_DEBT: 'close_client_debt',
    VERIFY_PAYMENT: 'verify_payment',
    DELETE: 'delete_clients',
    CREATE_INTERACTIONS: 'create_interactions',
    CREATE_TASKS: 'create_tasks',
    VIEW_TASKS: 'view_tasks',
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
    VIEW_OWN_REPORTS: 'view_own_reports',
    VIEW_TEAM_REPORTS: 'view_team_reports',
    VIEW_ALL_REPORTS: 'view_all_reports',
  },

  /**
   * Data Category (3 permissions)
   * Controls access to data import/export and client priority
   */
  DATA: {
    IMPORT: 'import_clients',
    IMPORT_PAYMENTS: 'import_payments',
    EXPORT: 'export_clients',
    MANAGE_PRIORITY: 'manage_client_priority',
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
   * Tags Category (6 permissions)
   * Controls access to tag management.
   * Note: Tags are admin-only for create/edit/delete; view is granted to operators.
   * Settings (manage_tag_settings) and system rules (manage_system_rules) are
   * gated separately so non-admin operators cannot reshape category lists or
   * delete protected system rules.
   */
  TAGS: {
    VIEW: 'view_tags',
    CREATE: 'create_tags',
    EDIT: 'edit_tags',
    DELETE: 'delete_tags',
    MANAGE_SETTINGS: 'manage_tag_settings',
    MANAGE_SYSTEM_RULES: 'manage_system_rules',
  },

  /**
   * Segments Category (reuses tags permissions)
   */
  SEGMENTS: {
    VIEW: 'view_tags',
    CREATE: 'create_tags',
    EDIT: 'edit_tags',
    DELETE: 'delete_tags',
  },

  /**
   * Rules Category (reuses tags permissions)
   */
  RULES: {
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
    MANAGE_SELLER_CONFIG: 'manage_seller_scoring_config',
    VIEW_HISTORY: 'view_scoring_config_history',
  },

  /**
   * TA Chains Category (1 permission)
   * Hard-delete a TA Chain (refused if the chain has any recorded history).
   * Note: create / edit / activate-deactivate continue to gate on manage_settings.
   */
  TA_CHAINS: {
    DELETE: 'delete_ta_chains',
  },

  /**
   * Action Analysis Category (16 permissions)
   * Controls access to the Action Analysis page and its drill-downs.
   * KAN-409 added the four operator-analytics sub-permissions; KAN-410
   * adds the eight quality-scoring sub-permissions (Scorecard, Markers,
   * Feedback, Score Dynamics).
   */
  ACTION_ANALYSIS: {
    VIEW: 'view_action_analysis',
    VIEW_CLICK_TRACKING: 'view_click_tracking',
    VIEW_SCREEN_TIME: 'view_screen_time',
    VIEW_ACTIVITY_HEATMAP: 'view_activity_heatmap',
    VIEW_SCRIPT_ANALYTICS: 'view_script_analytics',
    VIEW_TA_HISTORY: 'view_ta_history',
    VIEW_TASK_HISTORY: 'view_task_history',
    VIEW_PAYMENT_HISTORY: 'view_payment_history',
    // KAN-410 — Quality Scoring
    MANAGE_SCORECARD_TEMPLATES: 'manage_scorecard_templates',
    CREATE_SCORECARD: 'create_scorecard',
    VIEW_SCORECARD: 'view_scorecard',
    MANAGE_MARKERS: 'manage_markers',
    VIEW_MARKERS: 'view_markers',
    CREATE_FEEDBACK: 'create_feedback',
    VIEW_FEEDBACK: 'view_feedback',
    VIEW_SCORE_DYNAMICS: 'view_score_dynamics',
  },

  /**
   * Document Generation Category (5 permissions)
   * Each permission is atomic — any role holding it gains the
   * corresponding ability, regardless of the other four.
   */
  DOCUMENT_GENERATION: {
    VIEW_JOURNAL: 'view_document_journal',
    VIEW_TEMPLATES: 'view_document_templates',
    CREATE_EDIT_TEMPLATES: 'create_edit_document_templates',
    DELETE_TEMPLATES: 'delete_document_templates',
    GENERATE: 'generate_document',
  },

  /**
   * Restructuring Category (5 permissions)
   * Per-transition gates for manual RR status changes. Each button in
   * the RR actions column checks its specific permission. Automated
   * transitions (overdue / debt = 0 / payment events) bypass these
   * entirely — the system has its own authority.
   */
  RESTRUCTURING: {
    TRANSITION_CONNECTED_TO_VIOLATED: 'rr_transition_connected_to_violated',
    TRANSITION_VIOLATED_TO_CONNECTED: 'rr_transition_violated_to_connected',
    TRANSITION_CANCELLED_TO_CONNECTED: 'rr_transition_cancelled_to_connected',
    DISCONNECT: 'rr_disconnect',
    COMPLETE: 'rr_complete',
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
  TA_CHAINS: 'TA Chains',
  ACTION_ANALYSIS: 'Action Analysis',
  DOCUMENT_GENERATION: 'Document Generation',
  RESTRUCTURING: 'Restructuring',
} as const

/**
 * Permission descriptions for display in UI
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Clients
  view_clients: 'View client data and information',
  view_full_client_data: 'View unmasked client PII (name, phone, TIN) in dashboards',
  edit_clients: 'Edit client information (except debt amounts and tags)',
  assign_client_tags: 'Assign and remove tags on client profiles',
  edit_client_debt: 'Edit debt amounts and DPD (Days Past Due)',
  close_client_debt: 'Close/finalize a client debt (irreversible)',
  verify_payment: 'Verify and cancel client payments',
  delete_clients: 'Delete client records (soft delete)',
  create_interactions: 'Create client interactions (add notes)',
  create_tasks: 'Create and manage tasks for clients',
  view_tasks: 'View tasks for clients',

  // Communication
  make_calls: 'Make outbound phone calls to clients',
  send_sms: 'Send SMS messages to clients',
  view_call_history: 'View call recordings and SMS history',

  // Reports
  view_own_reports: 'View own performance statistics',
  view_team_reports: 'View team performance statistics',
  view_all_reports: 'View all system reports and analytics',

  // Data
  import_clients: 'Import client data from files',
  import_payments: 'Import payments from bank CSV files in bulk',
  export_clients: 'Export client and system data',
  manage_client_priority: 'Manually change client contact priority',

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
  manage_tag_settings:
    'Manage tag-service global settings (categories, presets, event registry view)',
  manage_system_rules: 'Edit and delete system-protected tag rules',

  // Sellers
  view_sellers: 'View seller/creditor list and details',
  create_sellers: 'Create new sellers/creditors',
  edit_sellers: 'Edit seller/creditor information',
  delete_sellers: 'Deactivate sellers/creditors',

  // Scoring Configuration
  view_scoring_config: 'View scoring configuration and thresholds',
  edit_scoring_config: 'Update scoring weights and priority thresholds',
  manage_seller_scoring_config: 'Manage seller-specific scoring configurations',
  view_scoring_config_history: 'View scoring configuration change history',

  // TA Chains
  delete_ta_chains: 'Delete TA Chains (refused if the chain has any recorded history)',
  // Action Analysis
  view_action_analysis: 'View Action Analysis page (call monitoring & interaction history)',
  view_click_tracking:
    'View Click Tracking timeline (operator action history synced to call recording)',
  view_screen_time: 'View Screen Time analysis (time-per-section with team benchmarking)',
  view_activity_heatmap: 'View Activity Heatmap (per-hour operator state grid)',
  view_script_analytics:
    'View Script Analytics & anomaly detection (interaction-result distribution and auto-flags)',
  view_ta_history: 'View TA History sub-tab (chain interactions with chain + step filters)',
  view_task_history: 'View Task History sub-tab (all operator tasks with filters)',
  view_payment_history: 'View Payment History sub-tab (all operator payments with filters)',
  // KAN-410 — Quality Scoring
  manage_scorecard_templates:
    'Manage scorecard templates (create / edit / archive sections, criteria, weights)',
  create_scorecard: 'Fill in and submit a quality-evaluation scorecard against a call recording',
  view_scorecard: 'View completed scorecards across operators',
  manage_markers: 'Create, edit, and delete timestamp markers on call recordings',
  view_markers: 'View timestamp markers across calls',
  create_feedback: 'Leave structured feedback (praise / note / correction task) on a call',
  view_feedback: 'View structured feedback threads across operators',
  view_score_dynamics: 'View operator score-dynamics chart, per-section breakdown, and alerts',

  // Document Generation
  view_document_journal: 'View the journal of all generated and uploaded documents',
  view_document_templates: 'View the list of document templates',
  create_edit_document_templates: 'Create and edit document templates',
  delete_document_templates: 'Delete document templates',
  generate_document: 'Generate a document on the client card',

  // Restructuring — per-transition gates on the RR action buttons
  rr_transition_connected_to_violated:
    'Manually flip a Connected restructuring agreement to Violated (Mark Violated button)',
  rr_transition_violated_to_connected:
    'Manually restore a Violated restructuring agreement to Connected (Restore button)',
  rr_transition_cancelled_to_connected:
    'Manually restore a Cancelled restructuring agreement to Connected (rare; mistaken cancellation)',
  rr_disconnect: 'Manually disconnect a restructuring agreement (status → Cancelled with reason)',
  rr_complete: 'Manually mark a restructuring agreement as Completed',
}
