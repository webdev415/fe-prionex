/**
 * Permission Constants
 *
 * Centralized permission definitions that match the backend RBAC system.
 * These permissions control access to features, routes, and UI elements.
 *
 * Backend Source: api-prionex/services/auth/alembic (seed + incremental migrations)
 */

export const PERMISSIONS = {
  /**
   * Clients Category (12 permissions)
   * Controls access to client data and management
   */
  CLIENTS: {
    VIEW: 'view_clients',
    VIEW_FULL_CLIENT_DATA: 'view_full_client_data',
    EDIT: 'edit_clients',
    REASSIGN_RESPONSIBLE: 'reassign_client_responsible',
    ASSIGN_TAGS: 'assign_client_tags',
    EDIT_DEBT: 'edit_client_debt',
    CLOSE_DEBT: 'close_client_debt',
    VERIFY_PAYMENT: 'verify_payment',
    DELETE: 'delete_clients',
    CREATE_INTERACTIONS: 'create_interactions',
    EDIT_INTERACTIONS: 'edit_interactions',
    DELETE_INTERACTIONS: 'delete_interactions',
    CREATE_TASKS: 'create_tasks',
    VIEW_TASKS: 'view_tasks',
  },

  /**
   * Write-offs Category (4 permissions, KAN-245)
   * Controls access to the per-accrual-type debt write-off CRUD.
   * Seeded by auth migration 028.
   */
  WRITEOFFS: {
    VIEW: 'view_writeoffs',
    CREATE: 'create_writeoffs',
    EDIT: 'edit_writeoffs',
    CANCEL: 'cancel_writeoffs',
    // Bulk CSV upload — gates the new bulk-import page. Required in
    // addition to CREATE.
    BULK: 'bulk_writeoff_operations',
  },

  /**
   * Sale Notes Category (1 permission)
   * Controls bulk upload + delete of primary creditor comments.
   * Seeded by auth migration 039.
   */
  SALE_NOTES: {
    MANAGE: 'manage_primary_creditor_comments',
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
   * Messaging Category (9 permissions)
   * Controls access to the unified messaging-service surfaces.
   */
  MESSAGING: {
    MANAGE_DRAFTS: 'manage_drafts',
    VIEW_CAMPAIGN_ANALYTICS: 'view_campaign_analytics',
    MANAGE_INTEGRATIONS: 'manage_messaging_integrations',
    SEND_MESSAGE_SMS: 'send_message_sms',
    SEND_MESSAGE_VIBER: 'send_message_viber',
    SEND_MESSAGE_EMAIL: 'send_message_email',
    LAUNCH_CAMPAIGN_SMS: 'launch_campaign_sms',
    LAUNCH_CAMPAIGN_VIBER: 'launch_campaign_viber',
    LAUNCH_CAMPAIGN_EMAIL: 'launch_campaign_email',
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
   * System Category (4 permissions)
   * Controls access to system administration
   */
  SYSTEM: {
    MANAGE_SETTINGS: 'manage_settings',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_ROLES: 'manage_roles',
    // Call QA — global «AI call analysis» switch + its settings surface
    MANAGE_CALL_QA: 'manage_call_qa',
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
   * Scoring Configuration Category (5 permissions)
   * Controls access to scoring algorithm configuration
   * Note: config permissions are restricted to Admin and Supervisor.
   *
   * VIEW_PRIORITY_SCORES is the exception and is deliberately separate (KAN-791,
   * auth migration 057): it grants read access to a debt's v3 priority BUCKET —
   * the client-card badge, list badges and the Priority Work List — and is held
   * by Operator as well, because operators are the audience for a work queue.
   * It does NOT grant any access to model configuration, and it is not what
   * gates the shadow-run report (that stays on VIEW).
   */
  SCORING_CONFIG: {
    VIEW: 'view_scoring_config',
    EDIT: 'edit_scoring_config',
    MANAGE_SELLER_CONFIG: 'manage_seller_scoring_config',
    VIEW_HISTORY: 'view_scoring_config_history',
    VIEW_PRIORITY_SCORES: 'view_priority_scores',
  },

  /**
   * Repayment Config Category (2 permissions, KAN-246)
   * Controls access to the global repayment order and write-off rule settings.
   * Seeded by auth migration 039. Admin + Supervisor only.
   */
  REPAYMENT_CONFIG: {
    VIEW: 'view_repayment_config',
    EDIT: 'edit_repayment_config',
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
   * Compatibility alias for the restored standalone Action Analysis page.
   * The page was relocated into TRAINING in development; the client asked to
   * keep the original page alongside it. These share the same backend
   * permission strings as TRAINING — this alias lets the restored page keep
   * its original `PERMISSIONS.ACTION_ANALYSIS.*` references unchanged.
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
    CREATE_SCORECARD: 'create_scorecard',
    VIEW_SCORECARD: 'view_scorecard',
    VIEW_MARKERS: 'view_markers',
    VIEW_FEEDBACK: 'view_feedback',
    VIEW_SCORE_DYNAMICS: 'view_score_dynamics',
    VIEW_INBOX: 'view_inbox',
    CREATE_ONE_ON_ONE: 'create_one_on_one',
    SELECT_INBOX_SCOPE: 'select_inbox_scope',
  },

  /**
   * Training Category (16 permissions)
   * Controls access to the Training page (formerly Action Analysis) and
   * its drill-downs. String values keep the `view_action_analysis` /
   * `view_*` prefixes because they are persisted in the backend `roles`
   * table — renaming them would require a server-side migration.
   */
  TRAINING: {
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
    // KAN-413 — Inbox triage queue
    VIEW_INBOX: 'view_inbox',
    MANAGE_COACHING_ASSIGNMENTS: 'manage_coaching_assignments',
    CREATE_ONE_ON_ONE: 'create_one_on_one',
    SELECT_INBOX_SCOPE: 'select_inbox_scope',
    // KAN-414 — Team tab (department / group rollup)
    VIEW_TEAM: 'view_team',
    // KAN-411 — Operator training (correction tasks / leaderboard / flags / library)
    MANAGE_CORRECTION_TASKS: 'manage_correction_tasks',
    VIEW_LEADERBOARD: 'view_leaderboard',
    MANAGE_BADGES: 'manage_badges',
    VIEW_AUTO_FLAGS: 'view_auto_flags',
    MANAGE_CALL_LIBRARY: 'manage_call_library',
    // Call QA (Ф1) — AI transcripts of call recordings (nightly brain run)
    VIEW_TRANSCRIPTS: 'view_transcripts',
    // Call QA (Ф2) — AI reviews (scores / red flags / conclusions) and the
    // blocker dictionary that drives critical-call detection
    VIEW_AI_REVIEWS: 'view_ai_reviews',
    MANAGE_BLOCKER_DICTIONARY: 'manage_blocker_dictionary',
    // KAN-749 — Trainings & Sessions surfaces (KAN-615 epic children)
    VIEW_COURSES: 'view_courses',
    MANAGE_COURSES: 'manage_courses',
    VIEW_TRAININGS: 'view_trainings',
    MANAGE_TRAININGS: 'manage_trainings',
    VIEW_DRILLS: 'view_drills',
    MANAGE_DRILLS: 'manage_drills',
    VIEW_TESTS: 'view_tests',
    MANAGE_TESTS: 'manage_tests',
    VIEW_MATERIALS: 'view_materials',
    MANAGE_MATERIALS: 'manage_materials',
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
   * Lawyer Workplace (KAN-486)
   * Inbox is head+; kanban is all legal department staff.
   */
  LEGAL_WORKPLACE: {
    VIEW: 'view_legal_workplace',
    VIEW_KANBAN: 'view_legal_kanban',
    MANAGE: 'manage_legal_workplace',
  },

  /**
   * Contact Types (CRM Settings directory for phone contact labels)
   */
  CONTACT_TYPES: {
    VIEW: 'view_contact_types',
    CREATE: 'create_contact_types',
    EDIT: 'edit_contact_types',
  },

  /**
   * Contact Tags (per-phone categorical metadata)
   */
  CONTACT_TAGS: {
    MANAGE: 'manage_contact_tag_categories',
    ASSIGN: 'assign_contact_tags',
    ASSIGN_PROTECTED: 'assign_protected_contact_tags',
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

  /**
   * UBKI Category (1 permission)
   * Gates manual and bulk outbound submission of credit data to the
   * UBKI credit bureau. The per-client opt-out toggle is gated by
   * edit_clients (it is a client-record edit), not this permission.
   */
  UBKI: {
    SUBMIT: 'submit_to_ubki',
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
  MESSAGING: 'Messaging',
  REPORTS: 'Reports',
  DATA: 'Data',
  USERS: 'Users',
  SYSTEM: 'System',
  PROJECTS: 'Projects',
  TAGS: 'Tags',
  SELLERS: 'Sellers',
  SCORING_CONFIG: 'Scoring Configuration',
  REPAYMENT_CONFIG: 'Repayment Configuration',
  TA_CHAINS: 'TA Chains',
  ACTION_ANALYSIS: 'Action Analysis',
  DOCUMENT_GENERATION: 'Document Generation',
  LEGAL_WORKPLACE: 'Lawyer Workplace',
  CONTACT_TYPES: 'Contact Types',
  CONTACT_TAGS: 'Contact Tags',
  RESTRUCTURING: 'Restructuring',
  UBKI: 'UBKI',
} as const

/**
 * Permission descriptions for display in UI
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // Clients
  view_clients: 'View client data and information',
  view_full_client_data: 'View unmasked client PII (name, phone, TIN) in dashboards',
  edit_clients: 'Edit client information (except reassignment, debt amounts and tags)',
  reassign_client_responsible: 'Change the responsible operator or searcher on a client',
  assign_client_tags: 'Assign and remove tags on client profiles',
  edit_client_debt: 'Edit debt amounts and DPD (Days Past Due)',
  close_client_debt: 'Close/finalize a client debt (irreversible)',
  verify_payment: 'Verify and cancel client payments',
  delete_clients: 'Delete client records (soft delete)',
  create_interactions: 'Create client interactions (add notes)',
  edit_interactions: 'Edit existing TA interactions on the client profile',
  delete_interactions: 'Delete existing TA interactions on the client profile',
  create_tasks: 'Create and manage tasks for clients',
  view_tasks: 'View tasks for clients',

  // Communication
  make_calls: 'Make outbound phone calls to clients',
  send_sms: 'Send SMS messages to clients',
  view_call_history: 'View call recordings and SMS history',

  // Messaging
  manage_drafts: 'Create, edit, and delete messaging drafts; open the Message Drafts settings page',
  view_campaign_analytics:
    'View campaign analytics, campaign recipients, CSV exports, and unified client message history',
  manage_messaging_integrations:
    'Create, edit, delete, test, and toggle messaging integrations (not list/read)',
  send_message_sms: 'Send single SMS; read integrations and drafts for SMS send',
  send_message_viber: 'Send single Viber messages; read integrations and drafts for Viber send',
  send_message_email: 'Send single emails; read integrations and drafts for email send',
  launch_campaign_sms: 'Bulk Messaging: launch SMS campaigns',
  launch_campaign_viber: 'Bulk Messaging: launch Viber campaigns',
  launch_campaign_email: 'Bulk Messaging: launch email campaigns',

  // Reports
  view_own_reports: 'View own performance statistics',
  view_team_reports: 'View team performance statistics',
  view_all_reports: 'View all system reports and analytics',

  // Data
  import_clients: 'Import client data from files',
  import_payments: 'Import payments from bank CSV files in bulk',
  export_clients: 'Export client and system data',
  manage_client_priority: 'Manually change client contact priority',
  manage_primary_creditor_comments: 'Upload bulk sale notes and delete individual sale notes',

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
  manage_call_qa: 'Toggle the global AI call analysis (Call QA) switch and manage its settings',

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
  view_priority_scores:
    'View v3 priority buckets and work ordering (client card, lists, work list)',

  // Repayment Configuration (KAN-246)
  view_repayment_config: 'View global repayment order and write-off rule configuration',
  edit_repayment_config: 'Edit global repayment order, write-off rules, and allocation algorithm',

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
  // KAN-413 — Inbox triage queue
  view_inbox: 'View the Inbox triage queue, header KPIs, and per-operator coaching detail',
  manage_coaching_assignments: 'Take charge of an operator and transition Kanban workflow state',
  create_one_on_one: 'Schedule a 1-on-1 session with an operator',
  select_inbox_scope: 'Show the My / Group / Department / All scope selector on the Inbox tab',
  // KAN-414 — Team tab
  view_team: 'View the Team tab — department / team rollup with per-operator composite scores',
  // KAN-411 — Operator training
  manage_correction_tasks:
    'Create / confirm / return correction tasks linked to calls (KAN-411 Feature 3.1)',
  view_leaderboard:
    'View the operator leaderboard with composite-score ranking + badges (KAN-411 Feature 3.2)',
  manage_badges: 'Manually award badges to operators (KAN-411 Feature 3.2)',
  view_auto_flags: 'Review the auto-flag inbox of suspicious calls (KAN-411 Feature 3.3)',
  manage_call_library:
    'Curate the training call library and assign learning plans (KAN-411 Feature 3.4)',

  // Trainings & Sessions (KAN-749 — KAN-615 epic children)
  view_courses: 'Browse the course catalogue and enrolled-course progress (KAN-750)',
  manage_courses: 'Create / publish / archive courses and assign enrollments (KAN-750)',
  view_trainings: 'Browse scheduled group training sessions (KAN-752)',
  manage_trainings: 'Schedule / cancel group training sessions (KAN-752)',
  view_drills: 'Browse drill exercises and attempts (KAN-751)',
  manage_drills: 'Create drills and review / score attempts (KAN-751)',
  view_tests: 'Browse the Tests surface (reserved)',
  manage_tests: 'Manage the Tests surface (reserved)',
  view_materials: 'Browse and download the materials library (KAN-616)',
  manage_materials: 'Upload / edit / archive materials (KAN-616)',
  // Call QA (Ф1)
  view_transcripts: 'View AI call transcripts (client card & Training; nightly Call QA run)',
  // Call QA (Ф2)
  view_ai_reviews: 'View AI call reviews (scores, red flags, conclusions) on Call QA surfaces',
  manage_blocker_dictionary: 'Manage the Call QA blocker dictionary (critical-call stop-words)',

  // Document Generation
  view_document_journal: 'View the journal of all generated and uploaded documents',
  view_document_templates: 'View the list of document templates',
  create_edit_document_templates: 'Create and edit document templates',
  delete_document_templates: 'Delete document templates',
  generate_document: 'Generate a document on the client card',

  // Lawyer Workplace
  view_legal_workplace: 'Access the Lawyer Workplace inbox and letter processing',
  view_legal_kanban: 'Access the Lawyer Workplace legal tasks kanban board',
  manage_legal_workplace:
    'Configure Lawyer Workplace settings (letter types, lawyers, mailboxes, templates)',

  // Contact Types (CRM Settings)
  view_contact_types: 'View Contact Types directory in Settings',
  create_contact_types: 'Create new contact types (requires view permission)',
  edit_contact_types: 'Edit contact types and hide or restore them (requires view permission)',

  // Contact Tags (per-phone categorical metadata)
  manage_contact_tag_categories:
    'Manage contact tag categories and values in Settings (create, edit, hide)',
  assign_contact_tags: 'Assign and remove contact tags on client phone numbers',
  assign_protected_contact_tags:
    'Assign and remove protected contact tags (requires elevated permission)',

  // Restructuring — per-transition gates on the RR action buttons
  rr_transition_connected_to_violated:
    'Manually flip a Connected restructuring agreement to Violated (Mark Violated button)',
  rr_transition_violated_to_connected:
    'Manually restore a Violated restructuring agreement to Connected (Restore button)',
  rr_transition_cancelled_to_connected:
    'Manually restore a Cancelled restructuring agreement to Connected (rare; mistaken cancellation)',
  rr_disconnect: 'Manually disconnect a restructuring agreement (status → Cancelled with reason)',
  rr_complete: 'Manually mark a restructuring agreement as Completed',

  // Write-offs (KAN-245)
  view_writeoffs: 'List and read individual debt write-off entries',
  create_writeoffs: 'Create one or more write-off entries on a debt',
  edit_writeoffs: 'Edit cancellation_date or notes on an existing write-off entry',
  cancel_writeoffs: 'Cancel an active write-off entry',
  bulk_writeoff_operations:
    'Upload a bulk write-off CSV — gates the bulk-import page (required alongside create_writeoffs)',

  // UBKI — outbound credit-bureau submission
  submit_to_ubki: 'Manually submit client credit data to the UBKI credit bureau (single and bulk)',
}
