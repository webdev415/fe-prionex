/**
 * Audit Service API Types
 * Matches backend Pydantic schemas
 */

export interface AuditLogCreate {
  user_id?: number | null
  username?: string | null
  user_role?: string | null
  action: string
  action_category?: string | null
  resource_type: string
  service_name?: string | null
  resource_id?: number | null
  resource_identifier?: string | null
  project_id?: number | null
  project_code?: string | null
  changes?: Record<string, { old: unknown; new: unknown }> | null
  record_before?: Record<string, unknown> | null
  record_after?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  request_id?: string | null
  session_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  success?: boolean
  error_code?: string | null
  error_message?: string | null
  contains_pii?: boolean
  is_impersonation?: boolean
  impersonated_user_id?: number | null
  impersonated_username?: string | null
  original_user_id?: number | null
}

export interface AuditLogResponse {
  event_id: string
  id: number
  timestamp: string // ISO datetime string
  user_id?: number | null
  username?: string | null
  user_role?: string | null
  user_email?: string | null
  action: string
  action_category: string
  action_type: string
  resource_type: string
  resource_id?: number | null
  resource_identifier?: string | null
  resource_name?: string | null
  project_id?: number | null
  project_code?: string | null
  changes?: Record<string, unknown> | null
  record_before?: Record<string, unknown> | null
  record_after?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  request_id?: string | null
  request_method?: string | null
  request_path?: string | null
  request_query_params?: Record<string, unknown> | null
  request_body_summary?: string | null
  response_status?: number | null
  response_time?: number | null
  ip_address?: string | null
  user_agent?: string | null
  device_type?: string | null
  browser?: string | null
  os?: string | null
  session_id?: string | null
  success: boolean
  error_code?: string | null
  error_message?: string | null
  contains_pii?: boolean
  is_impersonation?: boolean
  impersonated_user_id?: number | null
  impersonated_username?: string | null
  original_user_id?: number | null
  service_name?: string | null
}

export interface AuditLogSearchParams {
  user_id?: number
  action?: string
  resource_type?: string
  resource_id?: number
  resource_identifier?: string
  project_id?: number
  user_role?: string
  from_date?: string // YYYY-MM-DD
  to_date?: string // YYYY-MM-DD
  success?: boolean
  page?: number
  limit?: number
}

export interface AuditLogSearchResponse {
  total: number
  page: number
  limit: number
  logs: AuditLogResponse[]
}

export interface ResourceHistoryResponse {
  resource_type: string
  resource_id: string
  resource_name?: string | null
  total_events: number
  events: AuditLogResponse[]
}

export interface UserActivityResponse {
  user_id: number
  username: string
  total_events: number
  date_range: {
    from?: string | null
    to?: string | null
  }
  summary: Record<string, number>
  recent_events: Array<Record<string, unknown>>
}

export interface FailedLoginsResponse {
  total_failed_attempts: number
  date_range: {
    from: string
    to: string
  }
  attempts: Array<Record<string, unknown>>
  suspicious_ips: Array<Record<string, unknown>>
}

export interface DistinctRolesResponse {
  roles: string[]
}

export interface DistinctUsersResponse {
  users: string[]
}

export interface DistinctEntityTypesResponse {
  entity_types: string[]
}

export interface DistinctActionsResponse {
  actions: string[]
}

export interface CSVExportOptions {
  format: 'csv' | 'json'
  from_date?: string
  to_date?: string
  filters?: AuditLogSearchParams
}
