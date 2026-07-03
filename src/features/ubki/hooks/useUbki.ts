/**
 * React Query hooks for UBKI (credit bureau) outbound submission.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import i18n from '@/lib/i18n'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { ubkiApi } from '../api/ubkiApi'
import type {
  UbkiBulkOptOutRequest,
  UbkiBulkSubmitByClientsRequest,
  UbkiBulkSubmitRequest,
  UbkiLogsParams,
} from '../api/types'

const ubkiToast = (
  key: string,
  defaultValue: string,
  interpolation?: Record<string, string | number>
) => i18n.t(key, { ns: 'common', defaultValue, ...interpolation })

export const ubkiKeys = {
  all: ['ubki'] as const,
  logs: (params: UbkiLogsParams) => [...ubkiKeys.all, 'logs', params] as const,
}

/**
 * Manually submit a single credit/debt to UBKI.
 * Pass `clientId` so the client's loans/detail can be refetched on success.
 */
export function useSubmitDebtToUbki() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ debtId }: { debtId: number; clientId?: number }) =>
      ubkiApi.submitDebtToUbki(debtId),
    onSuccess: (result, variables) => {
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: clientKeys.loans(variables.clientId) })
        queryClient.invalidateQueries({
          queryKey: clientKeys.detail(variables.clientId),
          exact: true,
        })
      }
      queryClient.invalidateQueries({ queryKey: ubkiKeys.all })

      if (result.status === 'success') {
        toast.success(
          ubkiToast('pages.clients.detail.ubki.toasts.submitSuccess', 'Submitted to UBKI')
        )
      } else if (result.status === 'skipped') {
        toast.warning(
          result.error_message ||
            ubkiToast('pages.clients.detail.ubki.toasts.submitSkipped', 'Submission skipped')
        )
      } else {
        toast.error(
          result.error_message ||
            ubkiToast('pages.clients.detail.ubki.toasts.submitError', 'Submission to UBKI failed')
        )
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Bulk opt-out / re-enable clients for UBKI submission.
 */
export function useBulkOptOutUbki() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UbkiBulkOptOutRequest) => ubkiApi.bulkOptOutUbki(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      if (result.do_not_send) {
        toast.success(
          ubkiToast(
            'pages.clients.detail.ubki.toasts.optOutSuccess',
            '{{count}} client(s) opted out of UBKI',
            { count: result.updated_count }
          )
        )
      } else {
        toast.success(
          ubkiToast(
            'pages.clients.detail.ubki.toasts.optInSuccess',
            '{{count}} client(s) re-enabled for UBKI',
            { count: result.updated_count }
          )
        )
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Bulk submit multiple credits/debts to UBKI.
 */
export function useBulkSubmitToUbki() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UbkiBulkSubmitRequest) => ubkiApi.bulkSubmitToUbki(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.details() })
      queryClient.invalidateQueries({ queryKey: ubkiKeys.all })

      // Submission now runs as a background job (HTTP 202). Results land async
      // in the submission history; show a "queued" toast instead of counts.
      toast.success(
        ubkiToast(
          'pages.clients.detail.ubki.toasts.bulkQueued',
          'Queued {{count}} credit(s) for UBKI — results will appear in the submission history.',
          { count: result.queued_count }
        )
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Bulk submit to UBKI by clients (filter-driven bulk submission). The backend
 * expands each client to ALL their loans and submits them (opted-out clients
 * auto-skipped server-side). Mirrors {@link useBulkSubmitToUbki} but also
 * invalidates the client list since per-client submission state may change.
 */
export function useBulkSubmitByClients() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UbkiBulkSubmitByClientsRequest) => ubkiApi.bulkSubmitByClients(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      queryClient.invalidateQueries({ queryKey: clientKeys.details() })
      queryClient.invalidateQueries({ queryKey: ubkiKeys.all })

      // Submission now runs as a background job (HTTP 202). Results land async
      // in the submission history; show a "queued" toast instead of counts.
      toast.success(
        ubkiToast(
          'pages.clients.detail.ubki.toasts.bulkQueued',
          'Queued {{count}} credit(s) for UBKI — results will appear in the submission history.',
          { count: result.queued_count }
        )
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Submission history log, optionally scoped to one debt.
 *
 * `refetchInterval` (ms) lets callers poll while the panel is open, so rows
 * produced by a background bulk job appear without a manual refresh. Pass
 * `false` (the default) to disable polling.
 */
export function useUbkiLogs(
  params: UbkiLogsParams = {},
  enabled = true,
  refetchInterval: number | false = false
) {
  return useQuery({
    queryKey: ubkiKeys.logs(params),
    queryFn: () => ubkiApi.getUbkiLogs(params),
    enabled,
    refetchInterval: enabled ? refetchInterval : false,
  })
}
