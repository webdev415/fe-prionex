import { PERMISSIONS, type Permission } from '@/constants/permissions'

/**
 * Resolves the in-app destination for an audit row's Entity cell.
 *
 * The link logic is expressed as an ordered list of rules (`AUDIT_LINK_RULES`):
 * the first rule whose `match` returns true wins, and its `to` is returned only
 * if the viewer holds the rule's `permission` (otherwise `null` → plain text).
 *
 * Why a rule table: audit rows expose the linkable id in different places
 * (`entity_id`, `record_after.client_id`, or none → a list page), and some
 * `resource_type`s are shared (e.g. "template" for both SMS and document
 * templates) so must be told apart by the action. Each rule below documents the
 * shape it handles.
 */

// Minimal subset of the mapped audit row the resolver reads. A full `AuditLog`
// (from AuditLogsPage) satisfies this structurally, so no import is needed.
export interface AuditLinkFields {
  action_raw?: string
  entity_type?: string
  entity_id?: string
  record_client_id?: number
}

// Auth audit actions whose `resource_id` is a user — these link to that user
// in the Users table. Role/department auth events are intentionally excluded
// (their resource_id is a role/department, not a user). An explicit allowlist
// means any future auth action defaults to no-link rather than a wrong link.
const USER_CENTRIC_AUTH_ACTIONS = new Set<string>([
  'auth.login_success',
  'auth.logout',
  'auth.login_failed',
  'auth.two_factor.verify_success',
  'auth.two_factor.verify_failed',
  'auth.two_factor.setup_initiated',
  'auth.two_factor.enabled',
  'auth.two_factor.disabled',
  'auth.two_factor.backup_codes_regenerated',
  'auth.two_factor.backup_code_used',
  'auth.two_factor.disabled_by_admin',
  'auth.two_factor.reenabled_by_admin',
  'auth.impersonation_start',
  'auth.impersonation_exit',
  'auth.session_invalidated',
  'auth.permission_denied',
  'auth.permission_granted',
  'auth.admin_unlock_account',
  'auth.password_reset_by_admin',
  'auth.password_changed_by_user',
  // user-management — resource_id is the affected user
  'auth.user.created',
  'auth.user.updated',
  'auth.user.deactivated',
  'auth.user.reactivated',
])

// Auth role-management actions → the Roles page. Their resource_id is a role
// id (not a user), so they go to /dashboard/roles, never the users link.
const ROLE_AUTH_ACTIONS = new Set<string>([
  'auth.role.created',
  'auth.role.updated',
  'auth.role.deleted',
  'auth.role.archived',
])

// Auth department-management actions → the Departments page. resource_id is a
// department id. Departments share the `manage_roles` permission.
const DEPARTMENT_AUTH_ACTIONS = new Set<string>([
  'auth.department.created',
  'auth.department.updated',
  'auth.department.deleted',
])

// Auth project-management actions → the Projects page. resource_id is a
// project id. Gated on its own `manage_projects` permission.
const PROJECT_AUTH_ACTIONS = new Set<string>([
  'auth.project.created',
  'auth.project.updated',
  'auth.project.archived',
  'auth.project.restored',
])

// Selected client-management actions → that client's detail page. entity_id is
// the client id for the four single-client actions; the clients.bulk_* ones
// are multi-client (no entity_id) and so render plain text.
const CLIENT_LINK_ACTIONS = new Set<string>([
  'client.created',
  'client.updated',
  'client.deleted',
  'client.assigned',
  // clients.bulk_assigned moved to CLIENT_LIST_LINK_ACTIONS (→ /dashboard; no
  // single client id). clients.bulk_reassigned stays here but never matches (no
  // entity_id) → renders plain text.
  'clients.bulk_reassigned',
  // client.tag.* — each row is per-client (resource_id = the client), incl.
  // the bulk variants which write one audit row per client.
  'client.tag.assigned',
  'client.tag.removed',
  'client.tag.bulk_assigned',
  'client.tag.bulk_removed',
  // client.interaction.* — resource_id = the client
  'client.interaction.created',
  'client.interaction.updated',
  // client.rr.* (restructuring) — resource_id = the client
  'client.rr.connected',
  'client.rr.completed',
  'client.rr.disconnected',
  'client.rr.status_changed',
  'client.rr.overpayment_recorded',
  // client.task.* — resource_id = the client
  'client.task.created',
  'client.task.updated',
  'client.task.deleted',
  'client.task.completed',
  'client.task.cancelled',
  // debt.* — only the resource_type="client" rows (guarded below); the
  // resource_type="debt" rows carry a debt id, not a client, so they must NOT
  // resolve via entity_id.
  'debt.closed',
  'debt.closure_date_updated',
])

// Client search/filter events → the clients list (the dashboard index). These
// are list-level (no resource_id / client_id), so they link to the list page,
// not a client detail, and do not re-apply the logged search/filter.
const CLIENT_LIST_LINK_ACTIONS = new Set<string>([
  'client.searched',
  'client.list.filtered',
  // multi-client bulk wrappers — no single client id, so link to the list
  'clients.bulk_assigned',
  'clients.bulk_tag_assigned',
  'clients.bulk_tag_removed',
])

// Resource types whose audit rows store the client id in `record_after`
// (not `resource_id`, which is the call / interaction / contact / address /
// passport / employment / document / sms entity). Their Entity links to that
// client. For sms, only UI-driven sends (sms.sent / send-path sms.failed) carry
// a client_id; provider webhook callbacks have none and stay plain text.
// Exported: the mapping (mapAuditLogResponse) uses it to extract record_client_id.
export const RECORD_AFTER_CLIENT_TYPES = new Set<string>([
  'call',
  'ta_interaction',
  'contact',
  'address',
  'passport',
  'employment',
  'document',
  'sms',
  // Primary creditor comments. resource_id = note id; details.client_id
  // is mapped to record_after.client_id by audit-service, so the Entity
  // link resolves to the parent client's detail page.
  'client_sale_note',
])

// Tag-domain entity types → the tabbed Tags page (?tab=). Each resource_type is
// unique to its family. The client.tag.* assignment events are resource_type
// "client" and link to the client via CLIENT_LINK_ACTIONS — not here.
const TAG_PAGE_BY_TYPE: Record<string, string> = {
  tag: '/dashboard/system-settings/tags',
  segment: '/dashboard/system-settings/tags?tab=segments',
  tag_rule: '/dashboard/system-settings/tags?tab=rules',
  tag_settings: '/dashboard/system-settings/tags?tab=settings',
}

type LinkRule = {
  // Whether this rule applies to the row. Should also confirm the needed id is
  // present, so `to` always yields a valid destination.
  match: (log: AuditLinkFields) => boolean
  // The destination for a matched row.
  to: (log: AuditLinkFields) => string
  // The permission the viewer must hold for the link to render.
  permission: Permission
}

// Ordered — first match wins (mirrors the previous if-chain exactly).
const AUDIT_LINK_RULES: LinkRule[] = [
  // User-centric auth → that user. Gate on the action allowlist + entity_id
  // (NOT entity_type: auth.user.* rows are stored as resource_type "user").
  {
    match: (l) => !!l.entity_id && !!l.action_raw && USER_CENTRIC_AUTH_ACTIONS.has(l.action_raw),
    to: (l) => `/dashboard/users?user_id=${l.entity_id}`,
    permission: PERMISSIONS.USERS.VIEW,
  },
  // Role-management auth → the Roles page (list).
  {
    match: (l) => !!l.action_raw && ROLE_AUTH_ACTIONS.has(l.action_raw),
    to: () => '/dashboard/roles',
    permission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
  },
  // Department-management auth → the Departments page (list). Same permission.
  {
    match: (l) => !!l.action_raw && DEPARTMENT_AUTH_ACTIONS.has(l.action_raw),
    to: () => '/dashboard/departments',
    permission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
  },
  // Project-management auth → the Projects page (list).
  {
    match: (l) => !!l.action_raw && PROJECT_AUTH_ACTIONS.has(l.action_raw),
    to: () => '/dashboard/projects',
    permission: PERMISSIONS.PROJECTS.MANAGE,
  },
  // Selected client-management events → that client's detail. Requires
  // entity_type 'client' so the `debt.*` rows that are typed as `debt`
  // (entity_id = a debt id, not a client) don't mislink; entity_id is the
  // client id. clients.bulk_* have no entity_id, so they fall through.
  {
    match: (l) =>
      l.entity_type === 'client' &&
      !!l.action_raw &&
      CLIENT_LINK_ACTIONS.has(l.action_raw) &&
      !!l.entity_id,
    to: (l) => `/dashboard/clients/${l.entity_id}`,
    permission: PERMISSIONS.CLIENTS.VIEW,
  },
  // Client search/filter / bulk wrappers → the clients list (dashboard index).
  // List-level (no entity_id); a generic link, not a re-applied search/filter.
  {
    match: (l) => !!l.action_raw && CLIENT_LIST_LINK_ACTIONS.has(l.action_raw),
    to: () => '/dashboard',
    permission: PERMISSIONS.CLIENTS.VIEW,
  },
  // Call / TA-interaction / client sub-entities / sms → the related client. The
  // client id is on record_after (not resource_id), surfaced as
  // `record_client_id`; only links when present.
  {
    match: (l) =>
      !!l.entity_type && RECORD_AFTER_CLIENT_TYPES.has(l.entity_type) && !!l.record_client_id,
    to: (l) => `/dashboard/clients/${l.record_client_id}`,
    permission: PERMISSIONS.CLIENTS.VIEW,
  },
  // Payment events → that payment's client Debt Summary page (client id from
  // record_after). Distinct destination from the other record_after types; only
  // links when a client_id is present (historical/pre-field rows stay plain).
  {
    match: (l) => l.entity_type === 'payment' && !!l.record_client_id,
    to: (l) => `/dashboard/clients/${l.record_client_id}/debt-summary`,
    permission: PERMISSIONS.CLIENTS.VIEW,
  },
  // Non-client management entities → their own list/management page (no
  // per-item deep-link; gate by entity type + the page's permission).
  {
    match: (l) => l.entity_type === 'seller',
    to: () => '/dashboard/sellers',
    permission: PERMISSIONS.SELLERS.VIEW,
  },
  {
    match: (l) => l.entity_type === 'target_action' || l.entity_type === 'ta_chain',
    to: () => '/dashboard/system-settings/target-actions',
    permission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
  },
  // Document templates → the Document Generation page. resource_type is the
  // generic "template" (shared with SMS templates), so gate on the action.
  {
    match: (l) => !!l.action_raw?.startsWith('document_template.'),
    to: () => '/dashboard/system-settings/document-generation',
    permission: PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL,
  },
  // SMS templates → the SMS Templates page. Same generic "template"
  // resource_type, so gate on the action too.
  {
    match: (l) => !!l.action_raw?.startsWith('sms.template.'),
    to: () => '/dashboard/system-settings/sms-templates',
    permission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
  },
  // Scoring config events → the Scoring Configuration history page. Gated on
  // VIEW_HISTORY to match the history route. The score-calculation runs
  // (resource_type "scoring") have no per-run page → plain text.
  {
    match: (l) => l.entity_type === 'scoring_config',
    to: () => '/dashboard/system-settings/scoring-configuration/history',
    permission: PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY,
  },
  // Tag-domain events (tag / segment / tag_rule / tag_settings) → the tabbed
  // Tags page, deep-linked to the matching tab. All gate on TAGS.VIEW (the route
  // permission); the page handles its own per-tab sub-permission gating.
  {
    match: (l) => !!l.entity_type && l.entity_type in TAG_PAGE_BY_TYPE,
    to: (l) => TAG_PAGE_BY_TYPE[l.entity_type as string],
    permission: PERMISSIONS.TAGS.VIEW,
  },
  // Import job events → the Import History page. resource_type "import_job" is
  // unique to these, so gate on entity_type (list-page link; the per-job
  // history/:id route is intentionally not used here).
  {
    match: (l) => l.entity_type === 'import_job',
    to: () => '/dashboard/import/history',
    permission: PERMISSIONS.DATA.IMPORT,
  },
]

/**
 * Resolve an audit row's Entity destination, or `null` for plain text.
 * First matching rule wins; the link renders only if `hasPermission` is true
 * for that rule's permission.
 */
export function auditEntityLink(
  log: AuditLinkFields,
  hasPermission: (permission: Permission) => boolean
): string | null {
  for (const rule of AUDIT_LINK_RULES) {
    if (rule.match(log)) {
      return hasPermission(rule.permission) ? rule.to(log) : null
    }
  }
  return null
}
