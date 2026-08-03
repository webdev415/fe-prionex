/**
 * Dialer feature barrel (KAN-379).
 */

export { dialerService, default as dialerServiceDefault } from './api/dialerService'
export * from './types'
export * from './constants/dialer'
export {
  dialerQueuesKeys,
  useDialerQueues,
  useDialerQueuesPaged,
  useCreateDialerQueue,
  useUpdateDialerQueue,
  useDeleteDialerQueue,
  useSetDialerQueueActive,
  type DialerQueuesFilters,
  type DialerQueuesPagedFilters,
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
export {
  dialerSessionKeys,
  useMyDialerSession,
  useJoinQueue,
  useLeaveQueue,
} from './hooks/useDialerSession'
export { useDialerSocket, type DialerSocketState } from './hooks/useDialerSocket'
export { clientCallSummaryKeys, useClientCallSummary } from './hooks/useClientCallSummary'
