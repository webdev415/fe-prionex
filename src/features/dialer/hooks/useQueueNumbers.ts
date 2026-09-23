/**
 * Queue numbers hooks (KAN-379).
 *
 * Powers the supervisor "Queue of Numbers" tab (design: supervisor-04/05):
 * the queue status KPI strip plus the two-step CSV upload (preview then
 * confirm). Preview validates the whole file server-side and returns counts +
 * an upload token; confirm commits the validated batch with the chosen mode.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

import { dialerService } from '../api/dialerService'
import { dialerQueuesKeys } from './useDialerQueues'
import type { QueueStatusCounts, QueueUploadMode, QueueUploadResult } from '../types'

export const queueNumbersKeys = {
  all: ['dialerQueueNumbers'] as const,
  status: (queueId: number) => [...queueNumbersKeys.all, 'status', queueId] as const,
}

export function useQueueStatus(queueId: number | null, refetchMs?: number) {
  return useQuery<QueueStatusCounts>({
    queryKey: queueNumbersKeys.status(queueId ?? 0),
    queryFn: () => dialerService.getQueueStatus(queueId as number),
    enabled: !!queueId,
    refetchInterval: refetchMs,
  })
}

export function usePreviewQueueUpload() {
  return useMutation<QueueUploadResult, Error, { queueId: number; file: File }>({
    mutationFn: ({ queueId, file }) => dialerService.previewQueueUpload(queueId, file),
    // No toast here: validation errors are surfaced inline in the upload panel.
  })
}

export function useConfirmQueueUpload() {
  const queryClient = useQueryClient()
  return useMutation<
    { added_count: number },
    Error,
    { queueId: number; uploadToken: string; mode: QueueUploadMode }
  >({
    mutationFn: ({ queueId, uploadToken, mode }) =>
      dialerService.confirmQueueUpload(queueId, uploadToken, mode),
    onSuccess: (_data, { queueId }) => {
      queryClient.invalidateQueries({ queryKey: queueNumbersKeys.status(queueId) })
      queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all })
    },
    onError: (error) =>
      toast.error(
        error.message ||
          i18n.t('toasts.dialer.numbersUploadFailed', { defaultValue: 'Failed to upload numbers' })
      ),
  })
}

/** Bulk-add CRM clients to a queue (design: supervisor-06 "Add from CRM"). */
export function useAddClientsToQueue() {
  const queryClient = useQueryClient()
  return useMutation<
    { added_count: number; skipped_count: number },
    Error,
    { queueId: number; clients: { client_id: number; phone_number: string | null }[] }
  >({
    mutationFn: ({ queueId, clients }) => dialerService.addClientsFromCrm(queueId, clients),
    onSuccess: (_data, { queueId }) => {
      queryClient.invalidateQueries({ queryKey: queueNumbersKeys.status(queueId) })
      queryClient.invalidateQueries({ queryKey: dialerQueuesKeys.all })
    },
    onError: (error) =>
      toast.error(
        error.message ||
          i18n.t('toasts.dialer.addClientsFailed', {
            defaultValue: 'Failed to add clients to queue',
          })
      ),
  })
}
