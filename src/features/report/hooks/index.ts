/**
 * Report Hooks Index
 *
 * Re-export all hooks for easy importing.
 */

// Dashboard
export { useDashboard, dashboardKeys, type UseDashboardParams } from './useDashboard'

// Operator Performance
export {
  useOperatorPerformance,
  useAgentPerformanceTable,
  useSingleOperatorPerformance,
  operatorPerformanceKeys,
  type UseOperatorPerformanceParams,
} from './useOperatorPerformance'

// Client Statistics
export {
  useClientStatistics,
  useClientStatisticsByStatus,
  useClientStatisticsByPriority,
  useClientStatisticsByCity,
  useClientStatisticsByDebtRange,
  clientStatisticsKeys,
  type UseClientStatisticsParams,
} from './useClientStatistics'

// Communication Statistics
export {
  useCommunicationStatistics,
  useCallStatistics,
  useSMSStatistics,
  useMessagingStatistics,
  useCommunicationTrends,
  communicationStatisticsKeys,
  type UseCommunicationStatisticsParams,
} from './useCommunicationStatistics'

// Export
export {
  useExportDashboard,
  useExportOperatorPerformance,
  useExportClientStatistics,
  useExportCommunicationStatistics,
  type ExportDashboardParams,
  type ExportOperatorPerformanceParams,
  type ExportClientStatisticsParams,
  type ExportCommunicationStatisticsParams,
} from './useExport'

// Modal Data Hooks
export {
  useCallsMadeModal,
  useContactRateModal,
  useSMSSentModal,
  useMessagesSentModal,
  type CallsMadeModalData,
  type ContactRateModalData,
  type ContactRateOutcome,
  type SMSSentModalData,
  type MessagesSentModalData,
  type UseCallsMadeModalParams,
  type UseContactRateModalParams,
  type UseSMSSentModalParams,
  type UseMessagesSentModalParams,
} from './useModalData'
