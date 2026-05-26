/**
 * AuditLogsPage Component
 *
 * Main page for viewing audit logs with search and filtering capabilities.
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import { AuditLogDetailModal } from './components/AuditLogDetailModal'
import { CSVExportDialog, type CSVExportOptions } from './components/CSVExportDialog'
import {
  AuditLogsPageSkeleton,
  AuditLogsTableSectionSkeleton,
} from './components/AuditLogsPageSkeleton'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import {
  useAuditLogs,
  exportAuditLogs,
  getDistinctRoles,
  getDistinctUsers,
  getDistinctEntityTypes,
  getDistinctActions,
} from '@/features/audit'
import type { AuditLogResponse } from '@/features/audit/api/types'
import { toast } from 'sonner'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'

const DEFAULT_PAGE_SIZE = 10

export interface AuditLogChange {
  field_name: string
  old_value: string | null
  new_value: string | null
  change_type?: 'Added' | 'Modified' | 'Removed'
  calculated_change?: string // e.g., "-5,000.00 UAH"
}

export interface AuditLog {
  id: number
  timestamp: string
  status: 'success' | 'failed' // Status for the audit log entry
  user_id?: number
  username: string
  role?: string
  action: string // UPDATE, CREATE, LOGIN_FAILED, etc.
  action_raw?: string // raw event_type, e.g. "auth.login_success" (for entity links)
  record_client_id?: number // client id from record_after (call / ta_interaction rows)
  entity_type?: string // user, client, sms_template, etc. (legacy single filter)
  entity_types?: string[] // Multiple entity types filter
  entity_id?: string
  entity_name?: string // Display name for the entity (e.g., "Олена Коваленко")
  field_name?: string
  old_value?: string
  new_value?: string
  reason?: string
  ip_address?: string
  session_id?: string
  login_attempts?: number // For failed login attempts
  project_id?: number
  // For detail modal - changes array
  changes?: AuditLogChange[]
  // Request information
  http_method?: string // PUT, POST, GET, etc.
  api_path?: string // /api/clients/5678
  response_status?: string // 200 OK
  response_time?: number // 245 (ms)
  user_agent?: string // Chrome 120.0 (Windows 10)
}

export interface AuditLogFilters {
  search?: string
  status?: string
  client?: string
  period?: string
  date_from?: string
  date_to?: string
  user?: string // For backward compatibility, but can be comma-separated
  users?: string[] // Array of selected usernames
  entity_type?: string // Legacy single filter
  entity_types?: string[] // Multiple entity types filter
  action?: string // Legacy single filter
  actions?: string[] // Multiple actions filter
  role?: string
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
const RECORD_AFTER_CLIENT_TYPES = new Set<string>([
  'call',
  'ta_interaction',
  'contact',
  'address',
  'passport',
  'employment',
  'document',
  'sms',
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

// Resolve the in-app destination for an audit row's Entity, or null if it
// shouldn't be a link (no destination, or the viewer lacks permission).
function auditEntityLink(
  log: AuditLog,
  perms: {
    canViewUsers: boolean
    canManageRoles: boolean
    canManageProjects: boolean
    canViewClients: boolean
    canViewSellers: boolean
    canManageSettings: boolean
    canViewDocJournal: boolean
    canViewScoringHistory: boolean
    canViewTags: boolean
    canImportData: boolean
  }
): string | null {
  // User-centric auth → that user. Gate on the action allowlist + entity_id
  // (NOT entity_type: auth.user.* rows are stored as resource_type "user").
  if (log.entity_id && log.action_raw && USER_CENTRIC_AUTH_ACTIONS.has(log.action_raw)) {
    return perms.canViewUsers ? `/dashboard/users?user_id=${log.entity_id}` : null
  }
  // Role-management auth → the Roles page (list).
  if (log.action_raw && ROLE_AUTH_ACTIONS.has(log.action_raw)) {
    return perms.canManageRoles ? '/dashboard/roles' : null
  }
  // Department-management auth → the Departments page (list). Same permission.
  if (log.action_raw && DEPARTMENT_AUTH_ACTIONS.has(log.action_raw)) {
    return perms.canManageRoles ? '/dashboard/departments' : null
  }
  // Project-management auth → the Projects page (list).
  if (log.action_raw && PROJECT_AUTH_ACTIONS.has(log.action_raw)) {
    return perms.canManageProjects ? '/dashboard/projects' : null
  }
  // Selected client-management events → that client's detail. Requires
  // entity_type 'client' so the `debt.*` rows that are typed as `debt`
  // (entity_id = a debt id, not a client) don't mislink; entity_id is the
  // client id. clients.bulk_* have no entity_id, so they fall through to null.
  if (
    log.entity_type === 'client' &&
    log.action_raw &&
    CLIENT_LINK_ACTIONS.has(log.action_raw) &&
    log.entity_id
  ) {
    return perms.canViewClients ? `/dashboard/clients/${log.entity_id}` : null
  }
  // Client search/filter events → the clients list (dashboard index). List-level
  // (no entity_id); a generic link to the list, not a re-applied search/filter.
  if (log.action_raw && CLIENT_LIST_LINK_ACTIONS.has(log.action_raw)) {
    return perms.canViewClients ? '/dashboard' : null
  }
  // Call / TA-interaction events → the related client. The client id is on
  // record_after (not resource_id), surfaced as `record_client_id`; only
  // links when present (e.g. monitoring export / unmatched calls have none).
  if (log.entity_type && RECORD_AFTER_CLIENT_TYPES.has(log.entity_type) && log.record_client_id) {
    return perms.canViewClients ? `/dashboard/clients/${log.record_client_id}` : null
  }
  // Payment events → that payment's client Debt Summary page (client id from
  // record_after). Distinct destination from the other record_after types,
  // which go to the plain client detail. Only links when a client_id is
  // present (historical rows / pre-field edits stay plain text).
  if (log.entity_type === 'payment' && log.record_client_id) {
    return perms.canViewClients ? `/dashboard/clients/${log.record_client_id}/debt-summary` : null
  }
  // Non-client management entities → their own list/management page (no
  // per-item deep-link; gate by entity type + the page's permission).
  if (log.entity_type === 'seller') {
    return perms.canViewSellers ? '/dashboard/sellers' : null
  }
  if (log.entity_type === 'target_action' || log.entity_type === 'ta_chain') {
    return perms.canManageSettings ? '/dashboard/system-settings/target-actions' : null
  }
  // Document templates → the Document Generation page. resource_type is the
  // generic "template" (shared with SMS templates), so gate on the action, not
  // entity_type.
  if (log.action_raw?.startsWith('document_template.')) {
    return perms.canViewDocJournal ? '/dashboard/system-settings/document-generation' : null
  }
  // SMS templates → the SMS Templates page. Same generic "template"
  // resource_type, so gate on the action too.
  if (log.action_raw?.startsWith('sms.template.')) {
    return perms.canManageSettings ? '/dashboard/system-settings/sms-templates' : null
  }
  // Scoring config events → the Scoring Configuration history page (list-style
  // link; resource_type "scoring_config"). Gated on VIEW_HISTORY to match the
  // history route. The score-calculation runs (resource_type "scoring") have no
  // per-run page and fall through to plain text.
  if (log.entity_type === 'scoring_config') {
    return perms.canViewScoringHistory
      ? '/dashboard/system-settings/scoring-configuration/history'
      : null
  }
  // Tag-domain events (tag / segment / tag_rule / tag_settings) → the tabbed
  // Tags page, deep-linked to the matching tab. All gate on TAGS.VIEW (the route
  // permission); the page handles its own per-tab sub-permission gating.
  if (log.entity_type && TAG_PAGE_BY_TYPE[log.entity_type]) {
    return perms.canViewTags ? TAG_PAGE_BY_TYPE[log.entity_type] : null
  }
  // Import job events → the Import History page. resource_type "import_job" is
  // unique to these, so gate on entity_type (list-page link; the per-job
  // history/:id route is intentionally not used here).
  if (log.entity_type === 'import_job') {
    return perms.canImportData ? '/dashboard/import/history' : null
  }
  return null
}

export function AuditLogsPage() {
  const { t } = useTranslation('common')
  const canViewAuditLogs = useHasPermission(PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS)
  const canViewUsers = useHasPermission(PERMISSIONS.USERS.VIEW)
  const canManageRoles = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_ROLES)
  const canManageProjects = useHasPermission(PERMISSIONS.PROJECTS.MANAGE)
  const canViewClients = useHasPermission(PERMISSIONS.CLIENTS.VIEW)
  const canViewSellers = useHasPermission(PERMISSIONS.SELLERS.VIEW)
  const canManageSettings = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_SETTINGS)
  const canViewDocJournal = useHasPermission(PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL)
  const canViewScoringHistory = useHasPermission(PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY)
  const canViewTags = useHasPermission(PERMISSIONS.TAGS.VIEW)
  const canImportData = useHasPermission(PERMISSIONS.DATA.IMPORT)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filters, setFilters] = useState<AuditLogFilters>({})

  // Convert backend filters to API params
  // Include ALL filters so that any filter change triggers a backend request
  const apiParams = useMemo(() => {
    const params: Record<string, unknown> = {
      page: currentPage,
      limit: pageSize,
    }

    if (filters.date_from) params.from_date = filters.date_from
    if (filters.date_to) params.to_date = filters.date_to

    // Handle entity types filter (multiple or single)
    // Backend now supports multiple resource types
    // Convert display names (e.g., "Sms template") back to database format (e.g., "sms_template")
    if (filters.entity_types && filters.entity_types.length > 0) {
      params.resource_types = filters.entity_types.map((et) => {
        // Convert display name back to database format: replace spaces with underscores, lowercase
        return et.toLowerCase().replace(/\s+/g, '_')
      })
    } else if (filters.entity_type) {
      // Convert display name back to database format
      params.resource_type = filters.entity_type.toLowerCase().replace(/\s+/g, '_')
    }

    // Handle actions filter (multiple or single)
    // Backend now supports multiple actions and display names (e.g., "UPDATED")
    if (filters.actions && filters.actions.length > 0) {
      params.actions = filters.actions // Send display names as-is, backend will match
    } else if (filters.action) {
      params.action = filters.action // Send display name as-is
    }

    if (filters.status === 'success') params.success = true
    if (filters.status === 'failed') params.success = false
    if (filters.role) params.user_role = filters.role // Send role filter to API

    // Send search query to backend for server-side search
    if (filters.search) {
      params.search = filters.search
    }

    // Handle user filter - send usernames array to backend
    // Backend now supports multiple usernames
    if (filters.users && filters.users.length > 0) {
      params.usernames = filters.users
    } else if (filters.user) {
      // Single user - try to parse as user_id if numeric, otherwise use username
      const userId = parseInt(filters.user, 10)
      if (!isNaN(userId)) {
        params.user_id = userId
      } else {
        // If not numeric, send as single username in array
        params.usernames = [filters.user]
      }
    }

    return params
  }, [filters, currentPage, pageSize])

  // Fetch audit logs from API
  // React Query will automatically refetch when apiParams changes (including page changes)
  // The query key includes all params, so changing currentPage will trigger a new request
  // Only fetch if user has view_audit_logs permission
  const {
    data: auditData,
    isPending: auditLogsPending,
    error,
  } = useAuditLogs(apiParams, {
    enabled: canViewAuditLogs,
  })

  // Fetch distinct roles from API (separate query, cached)
  // Only fetch if user has view_audit_logs permission
  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['audit', 'roles'],
    queryFn: getDistinctRoles,
    enabled: canViewAuditLogs, // Only fetch if user has view_audit_logs permission
    staleTime: 0, // Always fetch fresh data - no cache
    gcTime: 0, // Don't keep in cache
  })

  // Fetch distinct users from API (separate query, cached)
  // Only fetch if user has view_audit_logs permission
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['audit', 'users'],
    queryFn: getDistinctUsers,
    enabled: canViewAuditLogs, // Only fetch if user has view_audit_logs permission
    staleTime: 0, // Always fetch fresh data - no cache
    gcTime: 0, // Don't keep in cache
  })

  // Fetch distinct entity types from API (separate query, cached)
  // Only fetch if user has view_audit_logs permission
  const { data: entityTypesData, isLoading: isLoadingEntityTypes } = useQuery({
    queryKey: ['audit', 'entity-types'],
    queryFn: getDistinctEntityTypes,
    enabled: canViewAuditLogs, // Only fetch if user has view_audit_logs permission
    staleTime: 0, // Always fetch fresh data - no cache
    gcTime: 0, // Don't keep in cache
  })

  // Fetch distinct actions from API (separate query, cached)
  // Only fetch if user has view_audit_logs permission
  const { data: actionsData, isLoading: isLoadingActions } = useQuery({
    queryKey: ['audit', 'actions'],
    queryFn: getDistinctActions,
    enabled: canViewAuditLogs, // Only fetch if user has view_audit_logs permission
    staleTime: 0, // Always fetch fresh data - no cache
    gcTime: 0, // Don't keep in cache
  })

  // Full-page skeleton only until filter dropdown data has loaded once (not on every audit refetch).
  const showFullPageSkeleton =
    (isLoadingRoles && !rolesData) ||
    (isLoadingUsers && !usersData) ||
    (isLoadingEntityTypes && !entityTypesData) ||
    (isLoadingActions && !actionsData)

  // Map backend response to frontend AuditLog type
  const mapAuditLogResponse = useCallback((log: AuditLogResponse): AuditLog => {
    // Extract entity name from resource_name (new field) or record_after/record_before
    let entityName: string | undefined
    // First check resource_name field (new field from backend)
    if (log.resource_name) {
      entityName = log.resource_name
    }
    // Fallback to record_after or record_before
    if (!entityName && log.record_after) {
      const record = log.record_after as Record<string, unknown>
      entityName =
        (record.full_name as string) ||
        (record.name as string) ||
        (record.client_name as string) ||
        (record.username as string) ||
        (record.email as string)
    }
    if (!entityName && log.record_before) {
      const record = log.record_before as Record<string, unknown>
      entityName =
        (record.full_name as string) ||
        (record.name as string) ||
        (record.client_name as string) ||
        (record.username as string) ||
        (record.email as string)
    }

    // Map changes to AuditLogChange format
    const changes: AuditLogChange[] = []
    if (log.changes) {
      Object.entries(log.changes).forEach(([field, change]) => {
        const changeObj = change as { old?: unknown; new?: unknown }
        let changeType: 'Added' | 'Modified' | 'Removed' | undefined
        if (changeObj.old === null || changeObj.old === undefined) {
          changeType = 'Added'
        } else if (changeObj.new === null || changeObj.new === undefined) {
          changeType = 'Removed'
        } else {
          changeType = 'Modified'
        }

        // Properly serialize values - handle objects, arrays, and primitives
        const serializeValue = (val: unknown, fieldName: string): string | null => {
          if (val === null || val === undefined) return null

          // Special handling for available_variables field
          if (fieldName === 'available_variables') {
            try {
              const parsed = typeof val === 'string' ? JSON.parse(val) : val
              if (Array.isArray(parsed)) {
                // Extract variable names and format as {variable_name}
                const variableNames = parsed
                  .map((item: unknown) => {
                    if (typeof item === 'object' && item !== null) {
                      const obj = item as Record<string, unknown>
                      return (obj.name as string) || (obj.variable as string) || String(item)
                    }
                    return String(item)
                  })
                  .filter((name: string) => name)
                if (variableNames.length === 0) return '(empty)'
                // Format as {variable1}, {variable2}, etc.
                return variableNames.map((name: string) => `{${name}}`).join(', ')
              }
            } catch {
              // If parsing fails, fall through to default handling
            }
          }

          // Handle objects and arrays
          if (typeof val === 'object') {
            try {
              return JSON.stringify(val, null, 2)
            } catch {
              return String(val)
            }
          }

          return String(val)
        }

        changes.push({
          field_name: field,
          old_value: serializeValue(changeObj.old, field),
          new_value: serializeValue(changeObj.new, field),
          change_type: changeType,
        })
      })
    }

    // Extract reason from multiple sources: record_after, record_before, or details
    let reason: string | undefined
    // First check record_after (backend stores details here)
    if (log.record_after && typeof log.record_after === 'object') {
      const details = log.record_after as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Then check record_before
    if (!reason && log.record_before && typeof log.record_before === 'object') {
      const details = log.record_before as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Also check details field directly (some services only send details, not record_after/before)
    if (!reason && log.details && typeof log.details === 'object') {
      const details = log.details as Record<string, unknown>
      reason = (details.reason as string) || (details.message as string) || undefined
    }
    // Also check if record_after itself is a string (some cases)
    if (!reason && typeof log.record_after === 'string') {
      reason = log.record_after
    }

    // Map action to display format
    const actionDisplay =
      log.action.split('.').pop()?.toUpperCase().replace(/_/g, ' ') || log.action

    // Some rows carry the client id inside record_after rather than
    // resource_id (call, ta_interaction, the client sub-entities, and payment);
    // surface it for the client link. Payment kept separate from
    // RECORD_AFTER_CLIENT_TYPES because it links to a different destination.
    let recordClientId: number | undefined
    if (
      log.resource_type &&
      (RECORD_AFTER_CLIENT_TYPES.has(log.resource_type) || log.resource_type === 'payment') &&
      log.record_after
    ) {
      const cid = Number((log.record_after as Record<string, unknown>).client_id)
      if (Number.isFinite(cid) && cid > 0) recordClientId = cid
    }

    return {
      id: log.id,
      timestamp: log.timestamp,
      status: log.success ? 'success' : 'failed',
      user_id: log.user_id ?? undefined,
      username: log.username || 'unknown',
      role: log.user_role ?? undefined,
      action: actionDisplay,
      action_raw: log.action,
      record_client_id: recordClientId,
      entity_type: log.resource_type,
      entity_id: log.resource_id?.toString() || log.resource_identifier || undefined,
      entity_name: entityName,
      ip_address: log.ip_address ?? undefined,
      session_id: log.session_id ?? undefined,
      project_id: log.project_id ?? undefined,
      changes: changes.length > 0 ? changes : undefined,
      http_method: log.request_method ?? undefined,
      api_path: log.request_path ?? undefined,
      response_status: log.response_status
        ? `${log.response_status} ${log.response_status < 300 ? 'OK' : 'Error'}`
        : undefined,
      response_time: log.response_time ?? undefined,
      user_agent: log.user_agent ?? undefined,
      reason,
    }
  }, [])

  // Convert API response to frontend format
  const auditLogs: AuditLog[] = useMemo(() => {
    if (!auditData?.logs) return []
    return auditData.logs.map(mapAuditLogResponse)
  }, [auditData, mapAuditLogResponse])

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    order: 'desc',
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)

  // Format timestamp for display (Nov 18\n10:30:45) - display directly from database
  // Parses ISO string and extracts time components directly without timezone conversion
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      // Parse ISO string directly to extract date/time components
      // Format: "2025-01-20T11:11:00+02:00" or "2025-01-20T11:11:00Z"
      const isoMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
      if (isoMatch) {
        const [, , month, day, hours, minutes, seconds] = isoMatch
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ]
        const monthIndex = parseInt(month, 10) - 1
        return `${monthNames[monthIndex]} ${parseInt(day, 10)}\n${hours}:${minutes}:${seconds}`
      }

      // Fallback to Date parsing if ISO format doesn't match
      const date = new Date(timestamp)
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      const month = monthNames[date.getUTCMonth()]
      const day = date.getUTCDate()
      const hours = date.getUTCHours().toString().padStart(2, '0')
      const minutes = date.getUTCMinutes().toString().padStart(2, '0')
      const seconds = date.getUTCSeconds().toString().padStart(2, '0')
      return `${month} ${day}\n${hours}:${minutes}:${seconds}`
    } catch {
      return timestamp
    }
  }, [])

  // Format currency helper
  const formatCurrency = useCallback((amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return String(amount)
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }, [])

  // Format details based on action type
  const formatDetails = useCallback(
    (log: AuditLog): string => {
      if (
        log.action === 'UPDATE' &&
        log.field_name === 'debt_amount' &&
        log.old_value &&
        log.new_value
      ) {
        return `Debt: ${formatCurrency(log.old_value)} → ${formatCurrency(log.new_value)} UAH`
      }
      if (log.action === 'CREATE' && log.entity_type === 'user') {
        return `Role: ${log.new_value || 'N/A'}, Project: ${log.entity_name || 'N/A'}`
      }
      if (log.action === 'LOGIN_FAILED' && log.ip_address) {
        const attempts = log.login_attempts || 1
        return `IP: ${log.ip_address}${attempts > 1 ? `\n(${attempts} attempts)` : ''}`
      }
      // Handle import events (action will be "STARTED", "COMPLETED", "FILE UPLOADED", etc. after transformation)
      if (log.entity_type === 'import_job' && log.reason) {
        return log.reason
      }
      // Handle import events by checking if action contains import-related keywords
      if (
        (log.action.includes('IMPORT') ||
          log.action === 'STARTED' ||
          log.action === 'COMPLETED' ||
          log.action === 'FILE UPLOADED' ||
          log.action === 'FAILED') &&
        log.entity_type === 'import_job' &&
        log.reason
      ) {
        return log.reason
      }
      // Handle call events
      if (log.entity_type === 'call' && log.reason) {
        return log.reason
      }
      // Handle scoring events (RUN STARTED, RUN COMPLETED, RUN FAILED)
      if (log.entity_type === 'score' && log.reason) {
        return log.reason
      }
      if (
        (log.action === 'RUN STARTED' ||
          log.action === 'RUN COMPLETED' ||
          log.action === 'RUN FAILED') &&
        log.entity_type === 'score' &&
        log.reason
      ) {
        return log.reason
      }
      // Handle auth events (LOGIN SUCCESS, LOGIN FAILED, LOGOUT)
      if (log.entity_type === 'auth' && log.reason) {
        return log.reason
      }
      if (
        (log.action === 'LOGIN SUCCESS' ||
          log.action === 'LOGIN FAILED' ||
          log.action === 'LOGOUT') &&
        log.entity_type === 'auth' &&
        log.reason
      ) {
        return log.reason
      }
      return log.reason || '—'
    },
    [formatCurrency]
  )

  // Format result column
  const formatEntity = useCallback((log: AuditLog): string => {
    if (log.entity_type && log.entity_name) {
      const entityTypeCapitalized =
        log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
      return `${entityTypeCapitalized}\n${log.entity_name}`
    }
    if (log.entity_type === 'user' && log.entity_id) {
      return `User: ${log.entity_id}`
    }
    if (log.action === 'LOGIN_FAILED' && log.reason) {
      return log.reason // e.g., "Invalid password"
    }
    // For import jobs, show filename if available (from resource_name)
    if (log.entity_type === 'import_job' && log.entity_name) {
      return log.entity_name // This will be the filename from resource_name
    }
    // For scoring events, show resource name if available (e.g., "Project 1")
    if (log.entity_type === 'score' && log.entity_name) {
      return log.entity_name // This will be the project name from resource_name
    }
    // For auth events, show username if available (from resource_name)
    if (log.entity_type === 'auth' && log.entity_name) {
      return log.entity_name // This will be the username from resource_name
    }
    if (log.entity_type) {
      return log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)
    }
    return '—'
  }, [])

  // All filtering is now handled by backend API
  // No client-side filtering needed
  const filteredLogs = useMemo(() => {
    const result = [...auditLogs]

    // All filters (actions, entity types, users, search, role) are handled by backend
    // Only sorting is done client-side (could be moved to backend later)

    // Apply sorting
    result.sort((a, b) => {
      const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key]
      const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key]

      if (aValue === bValue) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle timestamp sorting
      if (sortConfig.key === 'timestamp') {
        const aTime = new Date(aValue as string).getTime()
        const bTime = new Date(bValue as string).getTime()
        const comparison = aTime > bTime ? 1 : -1
        return sortConfig.order === 'asc' ? comparison : -comparison
      }

      const comparison = aValue > bValue ? 1 : -1
      return sortConfig.order === 'asc' ? comparison : -comparison
    })

    return result
  }, [auditLogs, sortConfig])

  // Pagination - always use API pagination since all filtering is done by backend
  const totalItems = auditData?.total || 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

  // API already handles pagination, so use filteredLogs directly
  const paginatedLogs = filteredLogs

  const handleFilterChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleSort = useCallback((key: string, order: SortOrder) => {
    setSortConfig({ key, order })
    setCurrentPage(1) // Reset to first page on sort change
  }, [])

  const handleExport = useCallback(() => {
    setIsExportDialogOpen(true)
  }, [])

  const handleExportConfirm = useCallback(
    async (options: CSVExportOptions) => {
      try {
        // Combine apiParams (filters) with CSV options
        const exportParams: Parameters<typeof exportAuditLogs>[1] = {
          ...apiParams,
          // CSV customization options
          columns: options.columns.join(','),
          date_format: options.dateFormat,
          delimiter: options.fieldDelimiter,
          encoding: options.encoding,
          include_headers: options.includeHeaders,
        }

        const blob = await exportAuditLogs('csv', exportParams)

        // Create download link
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast.success(t('pages.auditLogs.exportSuccess'))
      } catch (err) {
        console.error('Export failed:', err)
        toast.error(t('pages.auditLogs.exportError'))
      }
    },
    [apiParams, t]
  )

  // Get users from API data (all users in system, not just from audit logs)
  const users = useMemo(() => {
    if (!usersData?.users) return []
    return usersData.users.sort()
  }, [usersData])

  // Normalize roles from API response: always use title case for display
  const roles = useMemo(() => {
    if (!rolesData?.roles) return []

    const roleSet = new Set<string>()
    rolesData.roles.forEach((role) => {
      if (role) {
        // Normalize to title case: first letter uppercase, rest lowercase
        const normalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
        roleSet.add(normalized)
      }
    })

    // Return sorted list of normalized role names
    return Array.from(roleSet).sort()
  }, [rolesData])

  // Get entity types from API data (all entity types that appear in audit logs)
  const entityTypes = useMemo(() => {
    if (!entityTypesData?.entity_types) return []
    // Normalize to title case for display: first letter uppercase, rest lowercase, replace underscores with spaces
    return entityTypesData.entity_types
      .map((type) => {
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/_/g, ' ')
      })
      .sort()
  }, [entityTypesData])

  // Get actions from API data (all actions that appear in audit logs)
  // Normalize to match table display format: UPPERCASE with spaces (e.g., "LOGIN SUCCESS")
  const actions = useMemo(() => {
    if (!actionsData?.actions) return []
    // Normalize action names to match table display: extract last part, uppercase, replace underscores with spaces
    const normalizedActions = actionsData.actions.map((action) => {
      // Split by dot and take the last part (matches table display logic)
      const lastPart = action.split('.').pop() || action
      // Convert to UPPERCASE and replace underscores with spaces (matches table format)
      return lastPart.toUpperCase().replace(/_/g, ' ')
    })
    // Remove duplicates and sort
    return Array.from(new Set(normalizedActions)).sort()
  }, [actionsData])

  // Handle View Details click
  const handleViewDetails = useCallback((log: AuditLog) => {
    setSelectedLog(log)
    setIsDetailModalOpen(true)
  }, [])

  // Table columns definition - matching design
  const columns: Column<AuditLog>[] = useMemo(
    () => [
      {
        key: 'status',
        header: t('pages.auditLogs.tableHeaders.status'),
        align: 'left',
        sortable: false,
        render: (log) => (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full',
                log.status === 'success' ? 'bg-success-200' : 'bg-error-200'
              )}
            >
              {' '}
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  log.status === 'success' ? 'bg-success-500' : 'bg-error-500'
                )}
              />
            </span>
            <span
              className={cn(
                'text-sm font-medium',
                log.status === 'success' ? 'text-success-500' : 'text-error-500'
              )}
            >
              {log.status === 'success'
                ? t('pages.auditLogs.status.success')
                : t('pages.auditLogs.status.failed')}
            </span>
          </div>
        ),
      },
      {
        key: 'timestamp',
        header: t('pages.auditLogs.tableHeaders.timestamp'),
        sortable: true,
        render: (log) => (
          <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
            {formatTimestamp(log.timestamp)}
          </span>
        ),
      },
      {
        key: 'user',
        header: t('pages.auditLogs.tableHeaders.user'),
        sortable: true,
        sortKey: 'username',
        render: (log) => (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
              {log.username || '—'}
            </span>
            {log.role && (
              <span className="truncate overflow-hidden text-xs leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E] sm:text-sm">
                {log.role}
              </span>
            )}
            {!log.role && log.username === 'unknown' && (
              <span className="truncate overflow-hidden text-xs leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E] sm:text-sm">
                —
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'action',
        header: t('pages.auditLogs.tableHeaders.actions'),
        sortable: true,
        render: (log) => (
          <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
            {log.action || '—'}
          </span>
        ),
      },
      {
        key: 'entity',
        header: t('pages.auditLogs.tableHeaders.entity'),
        sortable: false,
        render: (log) => {
          const to = auditEntityLink(log, {
            canViewUsers,
            canManageRoles,
            canManageProjects,
            canViewClients,
            canViewSellers,
            canManageSettings,
            canViewDocJournal,
            canViewScoringHistory,
            canViewTags,
            canImportData,
          })
          if (to) {
            return (
              <Link
                to={to}
                className="text-primary-600 truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] hover:underline"
              >
                {formatEntity(log)}
              </Link>
            )
          }
          return (
            <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
              {formatEntity(log)}
            </span>
          )
        },
      },
      {
        key: 'details',
        header: t('pages.auditLogs.tableHeaders.details'),
        sortable: false,
        render: (log) => (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px] text-[#1E1E1E]">
              {formatDetails(log)}
            </span>
            <LinkButton
              variant="regular-secondary"
              size="xs"
              onClick={() => handleViewDetails(log)}
              leftIcon={<Icons.View size={14} strokeWidth={2} />}
              className="self-start sm:self-auto"
            >
              {t('pages.auditLogs.viewDetails')}
            </LinkButton>
          </div>
        ),
      },
    ],
    [
      formatTimestamp,
      formatEntity,
      formatDetails,
      handleViewDetails,
      t,
      canViewUsers,
      canManageRoles,
      canManageProjects,
      canViewClients,
      canViewSellers,
      canManageSettings,
      canViewDocJournal,
      canViewScoringHistory,
      canViewTags,
      canImportData,
    ]
  )

  // Show access denied message for users without view_audit_logs permission
  if (!canViewAuditLogs) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="rounded-xl bg-white/50 p-8 text-center">
          <Icons.Lock className="text-error-500 mx-auto mb-4 h-12 w-12" />
          <h2 className="text-dark-500 mb-2 text-xl font-semibold">
            {t('pages.auditLogs.accessDenied.title', 'Access Denied')}
          </h2>
          <p className="text-muted-foreground text-dark-500">
            {t(
              'pages.auditLogs.accessDenied.message',
              'You need the "View audit logs" permission to access this page. Please contact your administrator if you need access.'
            )}
          </p>
        </div>
      </div>
    )
  }

  if (showFullPageSkeleton) {
    return <AuditLogsPageSkeleton />
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.auditLogs.title')}
        </h1>
        <Button
          variant="primary"
          size="md"
          onClick={handleExport}
          leftIcon={<Icons.Download size={16} className="text-dark-500" />}
          className="h-[45px] w-full rounded-full text-xs sm:w-auto"
        >
          {t('pages.auditLogs.exportCsv')}
        </Button>
      </div>

      {/* Search & Filters */}
      <SearchFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        users={users}
        roles={roles}
        entityTypes={entityTypes}
        actions={actions}
        isLoading={auditLogsPending}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Audit Logs Table */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden rounded-xl bg-white/50 p-3 sm:gap-6 sm:p-6">
          {auditLogsPending ? (
            <AuditLogsTableSectionSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-error-500">{t('pages.auditLogs.loadError')}</div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={paginatedLogs}
              emptyMessage={t('pages.auditLogs.noLogsFound')}
              sortConfig={sortConfig}
              onSort={handleSort}
            />
          )}

          {/* Pagination */}
          {totalPages > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setCurrentPage(1) // Reset to first page when changing page size
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AuditLogDetailModal
        open={isDetailModalOpen}
        log={selectedLog}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLog(null)
        }}
      />
      <CSVExportDialog
        open={isExportDialogOpen}
        totalEntries={auditData?.total || 0}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExportConfirm}
      />
    </div>
  )
}

export default AuditLogsPage
