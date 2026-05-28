/**
 * Report Service API Types
 *
 * These types match the exact response structure from the Report Service backend.
 * DO NOT modify to match frontend expectations - use transformers instead.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Trend information for KPI comparison
 */
export interface KPITrend {
  direction: 'up' | 'down' | 'stable'
  change: number
  previous_value: number
}

/**
 * Standard KPI value with trend
 */
export interface KPIValue {
  value: number
  trend: KPITrend
}

/**
 * Payment KPI with amount and count
 */
export interface PaymentKPIValue {
  total_amount: number | string
  payment_count?: number
  average_amount?: number | string
  largest_amount?: number | string
  verified_amount?: number | string
  pending_amount?: number | string
  trend: KPITrend
}

/**
 * Date range for reports
 */
export interface DateRange {
  from_date: string
  to_date: string
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Top operator in dashboard
 */
export interface BackendTopOperator {
  operator_id: number
  operator_name: string
  calls_made: number
  contact_rate: number
}

/**
 * Dashboard KPIs from backend
 */
export interface MessagingSentKPIValue {
  value: number
  delivery_rate: number
  trend: KPITrend
  delivered?: number
  failed?: number
}

export interface BackendDashboardKPIs {
  calls_made: KPIValue
  contact_rate: KPIValue
  sms_sent: MessagingSentKPIValue
  messages_sent: MessagingSentKPIValue
  payments_collected: PaymentKPIValue
}

/**
 * Dashboard API Response
 * GET /api/v1/reports/dashboard
 */
export interface BackendDashboardResponse {
  project_id: number
  period: string
  generated_at: string
  kpis: BackendDashboardKPIs
  top_operators: BackendTopOperator[]
  payment_method_breakdown?: Array<{
    method: string
    count: number
    amount: number | string
    percentage: number
  }>
}

/**
 * Dashboard request parameters
 */
export interface DashboardParams {
  project_id: number
  period?: 'today' | 'this_week' | 'this_month' | 'custom'
  start_date?: string
  end_date?: string
  user_timezone?: string | null
}

// ============================================================================
// Operator Performance Types
// ============================================================================

/**
 * Daily breakdown for operator
 */
export interface BackendDailyBreakdown {
  date: string
  calls: number
  answered: number
  contact_rate: number
  talk_time: number
  sms_sent: number
  payments: number | string
}

/**
 * Operator summary metrics
 */
export interface BackendOperatorSummary {
  total_calls: number
  calls_answered: number
  contact_rate: number
  total_talk_time: number
  avg_call_duration: number
  sms_sent: number
  /** Messaging-service sends (parallel to legacy sms_sent). */
  messages_sent?: number
  payments_collected: number | string
  payments_count: number
}

/**
 * Individual operator performance
 */
export interface BackendOperatorPerformance {
  operator_id: number
  operator_name: string
  summary: BackendOperatorSummary
  daily_breakdown: BackendDailyBreakdown[]
  comparison_to_average?: Record<string, number>
}

/**
 * Team average metrics
 */
export interface BackendTeamAverage {
  total_calls: number
  contact_rate: number
  avg_call_duration: number
  sms_sent: number
  payments_collected: number | string
}

/**
 * Operator Performance API Response
 * GET /api/v1/reports/operator-performance
 */
export interface BackendOperatorPerformanceResponse {
  project_id: number
  date_range: DateRange
  operators: BackendOperatorPerformance[]
  team_average?: BackendTeamAverage
  generated_at: string
}

/**
 * Operator performance request parameters
 */
export interface OperatorPerformanceParams {
  project_id: number
  operator_id?: number
  from_date?: string
  to_date?: string
  user_timezone?: string | null
}

// ============================================================================
// Client Statistics Types
// ============================================================================

/**
 * Client group (status, priority, city, etc.)
 */
export interface BackendClientGroup {
  name: string
  count: number
  percentage: number
  total_debt: string | number
  avg_debt: string | number
}

/**
 * Client Statistics API Response
 * GET /api/v1/reports/client-statistics
 */
export interface BackendClientStatisticsResponse {
  project_id: number
  group_by: 'status' | 'priority' | 'city' | 'debt_range'
  total_clients: number
  total_debt: string | number
  average_debt: string | number
  groups: BackendClientGroup[]
  generated_at: string
}

/**
 * Client statistics request parameters
 */
export interface ClientStatisticsParams {
  project_id: number
  group_by?: 'status' | 'priority' | 'city' | 'debt_range'
}

// ============================================================================
// Communication Statistics Types
// ============================================================================

/**
 * Call statistics
 */
export interface BackendCallStatistics {
  total_calls: number
  calls_answered: number
  calls_no_answer: number
  calls_busy: number
  calls_failed: number
  contact_rate: number
  total_talk_time: number
  avg_call_duration: number
}

/**
 * SMS statistics
 */
export interface BackendSMSStatistics {
  total_sent: number
  delivered: number
  failed: number
  delivery_rate: number
}

/**
 * Top messaging draft usage row
 */
export interface BackendMessagingDraft {
  name: string
  count: number
  cost?: number
}

/**
 * Messaging statistics (messaging-service; parallel to sms_statistics)
 */
export interface BackendMessagingStatistics {
  total_sent: number
  delivered: number
  failed: number
  delivery_rate: number
  by_channel: Record<string, number>
  top_drafts: BackendMessagingDraft[]
}

/**
 * Daily communication trend
 */
export interface BackendDailyTrend {
  date: string
  calls: number
  calls_answered: number
  sms_sent: number
  sms_delivered: number
}

/**
 * Communication Statistics API Response
 * GET /api/v1/reports/communication-statistics
 */
export interface BackendCommunicationStatisticsResponse {
  project_id: number
  date_range: DateRange
  call_statistics: BackendCallStatistics
  sms_statistics: BackendSMSStatistics
  messaging_statistics?: BackendMessagingStatistics
  hourly_breakdown?: BackendHourlyBreakdown[]
  daily_trends?: BackendDailyTrend[]
  generated_at: string
}

/**
 * Hourly breakdown entry from call service
 */
export interface BackendHourlyBreakdown {
  /** UTC hour (0-23) */
  hour: number
  calls_made: number
  calls_answered: number
  sms_sent: number
}

/**
 * Communication statistics request parameters
 */
export interface CommunicationStatisticsParams {
  project_id: number
  from_date?: string
  to_date?: string
  user_timezone?: string | null
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'pdf'

/**
 * Export request parameters
 */
export interface ExportParams {
  project_id: number
  format: ExportFormat
  period?: string
  from_date?: string
  to_date?: string
  group_by?: string
  operator_id?: number
}
