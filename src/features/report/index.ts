/**
 * Report Feature
 *
 * Central export file for all report-related functionality.
 *
 * @example
 * ```tsx
 * import {
 *   useDashboard,
 *   useOperatorPerformance,
 *   useExportDashboard,
 *   type DashboardUI,
 * } from '@/features/report'
 * ```
 */

// API
export { reportApi } from './api/reportApi'
export type {
  BackendDashboardResponse,
  BackendOperatorPerformanceResponse,
  BackendClientStatisticsResponse,
  BackendCommunicationStatisticsResponse,
  DashboardParams,
  OperatorPerformanceParams,
  ClientStatisticsParams,
  CommunicationStatisticsParams,
  ExportParams,
  ExportFormat,
} from './api/types'

// Hooks
export {
  // Dashboard
  useDashboard,
  dashboardKeys,
  type UseDashboardParams,

  // Operator Performance
  useOperatorPerformance,
  useAgentPerformanceTable,
  useSingleOperatorPerformance,
  operatorPerformanceKeys,
  type UseOperatorPerformanceParams,

  // Client Statistics
  useClientStatistics,
  useClientStatisticsByStatus,
  useClientStatisticsByPriority,
  useClientStatisticsByCity,
  useClientStatisticsByDebtRange,
  clientStatisticsKeys,
  type UseClientStatisticsParams,

  // Communication Statistics
  useCommunicationStatistics,
  useCallStatistics,
  useSMSStatistics,
  useCommunicationTrends,
  communicationStatisticsKeys,
  type UseCommunicationStatisticsParams,

  // Export
  useExportDashboard,
  useExportOperatorPerformance,
  useExportClientStatistics,
  useExportCommunicationStatistics,
  type ExportDashboardParams,
  type ExportOperatorPerformanceParams,
  type ExportClientStatisticsParams,
  type ExportCommunicationStatisticsParams,

  // Modal Data Hooks
  useCallsMadeModal,
  useContactRateModal,
  useSMSSentModal,
  type CallsMadeModalData,
  type ContactRateModalData,
  type ContactRateOutcome,
  type SMSSentModalData,
  type UseCallsMadeModalParams,
  type UseContactRateModalParams,
  type UseSMSSentModalParams,
} from './hooks'

// Types (Frontend UI types)
export type {
  Period,
  BackendPeriod,
  TrendDirection,
  ChangeType,
  KPITrendUI,
  DashboardUI,
  DashboardKPIsUI,
  TopOperatorUI,
  OperatorPerformanceResponseUI,
  OperatorPerformanceUI,
  OperatorSummaryUI,
  DailyBreakdownUI,
  TeamAverageUI,
  ClientStatisticsUI,
  ClientGroupUI,
  CommunicationStatisticsUI,
  CallStatisticsUI,
  SMSStatisticsUI,
  DailyTrendUI,
  AgentPerformanceRow,
} from './types'

// Utils
export {
  mapPeriodToBackend,
  mapPeriodToFrontend,
  formatDuration,
  transformDashboard,
  transformOperatorPerformance,
  transformClientStatistics,
  transformCommunicationStatistics,
  transformToAgentPerformanceRows,
} from './utils/transformers'
