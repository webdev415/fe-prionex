/**
 * SMS Service Hooks
 * React Query hooks for SMS operations
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getClientSMSHistory,
  getDeletedTemplates,
  getSMSConfig,
  getTemplate,
  getTemplates,
} from '../api/smsApi'
import type { SMSHistoryParams } from '../api/types'

/**
 * Get SMS templates list
 */
export function useSMSTemplates(params?: { project_id?: number; category?: string }) {
  return useQuery({
    queryKey: ['sms', 'templates', params],
    queryFn: () => getTemplates(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * List soft-deleted templates (trash)
 *
 * Keyed under ['sms', 'templates'] on purpose: every template mutation already
 * invalidates that prefix, so the trash view and the live list cannot drift.
 */
export function useDeletedSMSTemplates(
  params?: { category?: string; limit?: number; offset?: number },
  enabled = true
) {
  return useQuery({
    queryKey: ['sms', 'templates', 'trash', params],
    queryFn: () => getDeletedTemplates(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/**
 * Get single SMS template
 */
export function useSMSTemplate(templateId: number | null) {
  return useQuery({
    queryKey: ['sms', 'templates', templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: !!templateId,
  })
}

/**
 * Get SMS history for a client
 */
export function useSMSHistory(clientId: number | null, params?: SMSHistoryParams) {
  return useQuery({
    queryKey: ['sms', 'history', clientId, params],
    queryFn: () => getClientSMSHistory(clientId!, params),
    enabled: !!clientId,
  })
}

/**
 * Get SMS configuration
 */
export function useSMSConfig(projectId?: number) {
  return useQuery({
    queryKey: ['sms', 'config', projectId],
    queryFn: () => getSMSConfig(projectId),
  })
}
