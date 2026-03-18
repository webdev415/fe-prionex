/**
 * React hooks for audit log queries
 */

import { useQuery } from '@tanstack/react-query'
import {
  searchAuditLogs,
  getResourceHistory,
  getUserActivity,
  getFailedLogins,
} from '../api/auditApi'
import type { AuditLogSearchParams } from '../api/types'

/**
 * Query key factory for audit logs
 */
export const auditKeys = {
  all: ['audit'] as const,
  searches: () => [...auditKeys.all, 'search'] as const,
  search: (params: AuditLogSearchParams) => [...auditKeys.searches(), params] as const,
  resourceHistory: (resourceType: string, resourceId: string | number) =>
    [...auditKeys.all, 'resource', resourceType, resourceId] as const,
  userActivity: (userId: number, params?: Record<string, unknown>) =>
    [...auditKeys.all, 'user', userId, params] as const,
  failedLogins: (fromDate?: string, toDate?: string) =>
    [...auditKeys.all, 'failed-logins', fromDate, toDate] as const,
}

/**
 * Search audit logs with filters
 */
export function useAuditLogs(params: AuditLogSearchParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: auditKeys.search(params),
    queryFn: () => searchAuditLogs(params),
    enabled: options?.enabled !== false, // Default to true, can be disabled
    staleTime: 0, // Always refetch when params change (no stale time)
    gcTime: 5 * 60 * 1000, // 5 minutes
    // Ensure refetch when query key changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

/**
 * Get audit history for a specific resource
 */
export function useResourceHistory(
  resourceType: string,
  resourceId: string | number,
  enabled = true
) {
  return useQuery({
    queryKey: auditKeys.resourceHistory(resourceType, resourceId),
    queryFn: () => getResourceHistory(resourceType, resourceId),
    enabled: enabled && !!resourceType && !!resourceId,
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Get activity log for a specific user
 */
export function useUserActivity(
  userId: number,
  params?: {
    from_date?: string
    to_date?: string
    action?: string
    page?: number
    limit?: number
  },
  enabled = true
) {
  return useQuery({
    queryKey: auditKeys.userActivity(userId, params),
    queryFn: () => getUserActivity(userId, params),
    enabled: enabled && !!userId,
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Get failed login attempts
 */
export function useFailedLogins(fromDate?: string, toDate?: string, enabled = true) {
  return useQuery({
    queryKey: auditKeys.failedLogins(fromDate, toDate),
    queryFn: () => getFailedLogins(fromDate, toDate),
    enabled,
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}
