/**
 * React Query hooks for UBKI (credit bureau) outbound submission.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import i18n from '@/lib/i18n'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { ubkiApi } from '../api/ubkiApi'
import type { UbkiBulkOptOutRequest, UbkiBulkSubmitRequest, UbkiLogsParams } from '../api/types'

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

      const summary = ubkiToast(
        'pages.clients.detail.ubki.toasts.bulkSubmitSummary',
        '{{success}} sent, {{skipped}} skipped, {{error}} failed',
        {
          success: result.success_count,
          skipped: result.skipped_count,
          error: result.error_count,
        }
      )
      if (result.error_count > 0) {
        toast.warning(summary)
      } else {
        toast.success(summary)
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Submission history log, optionally scoped to one debt.
 */
export function useUbkiLogs(params: UbkiLogsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ubkiKeys.logs(params),
    queryFn: () => ubkiApi.getUbkiLogs(params),
    enabled,
  })
}
