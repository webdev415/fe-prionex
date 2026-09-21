/**
 * SMS Service Mutation Hooks
 * React Query mutation hooks for SMS operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import type { AxiosError } from 'axios'
import {
  sendSMS,
  sendBulkSMS,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  restoreTemplate,
  updateSMSConfig,
} from '../api/smsApi'
import type {
  SendSMSRequest,
  BulkSendSMSRequest,
  TemplateCreate,
  TemplateUpdate,
  SMSConfigUpdate,
} from '../api/types'

/**
 * Send SMS to a single client
 */
export function useSendSMS() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SendSMSRequest) => sendSMS(request),
    onSuccess: (_data, variables) => {
      // Invalidate SMS history for the client to refresh the list
      // Use predicate to match all queries for this client_id regardless of params
      if (variables.client_id) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey[0] === 'sms' &&
              query.queryKey[1] === 'history' &&
              query.queryKey[2] === variables.client_id
            )
          },
        })
        // Also invalidate the client detail call/SMS history panel
        queryClient.invalidateQueries({
          queryKey: ['clients', 'detail', variables.client_id, 'callSmsHistory'],
        })
      }
      // Invalidate templates to update usage stats
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.sendFailed', { defaultValue: 'Failed to send SMS' })
      toast.error(message)
    },
  })
}

/**
 * Send bulk SMS to multiple clients
 */
export function useSendBulkSMS() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: BulkSendSMSRequest) => sendBulkSMS(request),
    onSuccess: () => {
      // Invalidate templates to update usage stats
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
      toast.success(i18n.t('toasts.sms.bulkStarted', { defaultValue: 'Bulk SMS sending started' }))
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.bulkSendFailed', { defaultValue: 'Failed to send bulk SMS' })
      toast.error(message)
    },
  })
}

/**
 * Create SMS template
 */
export function useCreateSMSTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (template: TemplateCreate) => createTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
      // Toast notification is handled by the component (CreateTemplateForm)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.templateCreateFailed', { defaultValue: 'Failed to create template' })
      toast.error(message)
    },
  })
}

// Alias for backward compatibility
export const useCreateTemplate = useCreateSMSTemplate

/**
 * Update SMS template
 */
export function useUpdateSMSTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, template }: { templateId: number; template: TemplateUpdate }) =>
      updateTemplate(templateId, template),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates', variables.templateId] })
      // Toast notification is handled by the component (EditTemplateForm)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.templateUpdateFailed', { defaultValue: 'Failed to update template' })
      toast.error(message)
    },
  })
}

// Alias for backward compatibility
export const useUpdateTemplate = useUpdateSMSTemplate

/**
 * Delete SMS template
 */
export function useDeleteSMSTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: number) => deleteTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
      // Toast notification is handled by the component (DeleteTemplateModal)
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.templateDeleteFailed', { defaultValue: 'Failed to delete template' })
      toast.error(message)
    },
  })
}

// Alias for backward compatibility
export const useDeleteTemplate = useDeleteSMSTemplate

/**
 * Restore a soft-deleted SMS template
 */
export function useRestoreSMSTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: number) => restoreTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'templates'] })
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.templateRestoreFailed', { defaultValue: 'Failed to restore template' })
      toast.error(message)
    },
  })
}

/**
 * Update SMS configuration
 */
export function useUpdateSMSConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: SMSConfigUpdate) => updateSMSConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'config'] })
      toast.success(
        i18n.t('toasts.sms.configUpdated', {
          defaultValue: 'SMS configuration updated successfully',
        })
      )
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error?.response?.data?.detail ||
        i18n.t('toasts.sms.configUpdateFailed', {
          defaultValue: 'Failed to update SMS configuration',
        })
      toast.error(message)
    },
  })
}
