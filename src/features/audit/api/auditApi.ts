/**
 * Audit Service API
 *
 * All endpoints require admin authentication.
 * Uses main api client (goes through Kong on port 8000)
 */

import api from '@/lib/api'
import type {
  AuditLogSearchParams,
  AuditLogSearchResponse,
  DistinctRolesResponse,
  DistinctUsersResponse,
  DistinctEntityTypesResponse,
  DistinctActionsResponse,
  ResourceHistoryResponse,
  UserActivityResponse,
  FailedLoginsResponse,
} from './types'

const BASE_URL = '/api/v1/audit'

/**
 * Search audit logs with filters
 * Requires Admin role
 */
export async function searchAuditLogs(
  params: AuditLogSearchParams = {}
): Promise<AuditLogSearchResponse> {
  // FastAPI expects array parameters as multiple query params with same name
  // e.g., ?actions=UPDATED&actions=CREATED (not ?actions[]=UPDATED)
  // axios by default serializes arrays correctly for this
  const response = await api.get<AuditLogSearchResponse>(`${BASE_URL}/logs`, {
    params,
    // Ensure arrays are serialized as multiple params with same name (not brackets)
    paramsSerializer: {
      indexes: null, // This makes axios send ?actions=val1&actions=val2 instead of ?actions[]=val1
    },
  })
  return response.data
}

/**
 * Get audit history for a specific resource
 * Requires Admin role
 */
export async function getResourceHistory(
  resourceType: string,
  resourceId: string | number
): Promise<ResourceHistoryResponse> {
  const response = await api.get<ResourceHistoryResponse>(
    `${BASE_URL}/logs/resource/${resourceType}/${resourceId}`
  )
  return response.data
}

/**
 * Get activity log for a specific user
 * Requires Admin role
 */
export async function getUserActivity(
  userId: number,
  params?: {
    from_date?: string
    to_date?: string
    action?: string
    page?: number
    limit?: number
  }
): Promise<UserActivityResponse> {
  const response = await api.get<UserActivityResponse>(`${BASE_URL}/logs/user/${userId}`, {
    params,
  })
  return response.data
}

/**
 * Get failed login attempts
 * Requires Admin role
 */
export async function getFailedLogins(
  fromDate?: string,
  toDate?: string
): Promise<FailedLoginsResponse> {
  const params: Record<string, string> = {}
  if (fromDate) params.from_date = fromDate
  if (toDate) params.to_date = toDate

  const response = await api.get<FailedLoginsResponse>(`${BASE_URL}/security/failed-logins`, {
    params,
  })
  return response.data
}

/**
 * Export audit logs to CSV or JSON
 * Requires Admin role
 */
export async function exportAuditLogs(
  format: 'csv' | 'json',
  params?: AuditLogSearchParams & {
    columns?: string
    date_format?: string
    delimiter?: string
    encoding?: string
    include_headers?: boolean
    search?: string
    usernames?: string
  }
): Promise<Blob> {
  const response = await api.get(`${BASE_URL}/logs/export`, {
    params: {
      ...params,
      format,
    } as Record<string, unknown>,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get distinct user roles from audit logs
 * Requires Admin role
 */
export async function getDistinctRoles(): Promise<DistinctRolesResponse> {
  const response = await api.get<DistinctRolesResponse>(`${BASE_URL}/roles`)
  return response.data
}

/**
 * Get distinct users from audit logs and users table
 * Requires Admin role
 */
export async function getDistinctUsers(): Promise<DistinctUsersResponse> {
  const response = await api.get<DistinctUsersResponse>(`${BASE_URL}/users`)
  return response.data
}

/**
 * Get distinct entity types from audit logs
 * Requires Admin role
 */
export async function getDistinctEntityTypes(): Promise<DistinctEntityTypesResponse> {
  const response = await api.get<DistinctEntityTypesResponse>(`${BASE_URL}/entity-types`)
  return response.data
}

/**
 * Get distinct actions from audit logs
 * Requires Admin role
 */
export async function getDistinctActions(): Promise<DistinctActionsResponse> {
  const response = await api.get<DistinctActionsResponse>(`${BASE_URL}/actions`)
  return response.data
}
