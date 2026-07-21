/**
 * Dialer feature barrel (KAN-379).
 */

export { dialerService, default as dialerServiceDefault } from './api/dialerService'
export * from './types'
export * from './constants/dialer'
export {
  dialerQueuesKeys,
  useDialerQueues,
  useCreateDialerQueue,
  useUpdateDialerQueue,
  useDeleteDialerQueue,
  useSetDialerQueueActive,
  type DialerQueuesFilters,
} from './hooks/useDialerQueues'
export {
  queueNumbersKeys,
  useQueueStatus,
  usePreviewQueueUpload,
  useConfirmQueueUpload,
  useAddClientsToQueue,
} from './hooks/useQueueNumbers'
export {
  dialerStatsKeys,
  useOperatorStats,
  useSimStats,
  type DialerStatsFilters,
} from './hooks/useDialerStats'
