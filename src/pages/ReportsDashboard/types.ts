/**
 * Report Dashboard Page Types
 *
 * Re-exports types from the report feature for backward compatibility.
 * New code should import directly from '@/features/report'.
 */

// Re-export all types from the feature
export type {
  Period,
  DashboardUI as DashboardResponse,
  DashboardKPIsUI as DashboardKPIs,
  TopOperatorUI as TopOperator,
  OperatorPerformanceResponseUI as OperatorPerformanceResponse,
  OperatorPerformanceUI as OperatorPerformance,
  OperatorSummaryUI as OperatorSummary,
  DailyBreakdownUI as DailyBreakdown,
  CommunicationStatisticsUI as CommunicationStatisticsResponse,
  CallStatisticsUI as CallStatistics,
  SMSStatisticsUI as SmsStatistics,
  DailyTrendUI as CommunicationTrend,
  ClientStatisticsUI as ClientStatistics,
  KPITrendUI as KPIChange,
} from '@/features/report'
