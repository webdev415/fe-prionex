/**
 * Report Feature Frontend Types
 *
 * These types are what the UI components expect after data transformation.
 * They are different from backend API types (see api/types.ts).
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Period type for date filtering
 */
export type Period = 'today' | 'thisWeek' | 'thisMonth' | 'custom'

/**
 * Backend period format
 */
export type BackendPeriod = 'today' | 'this_week' | 'this_month' | 'custom'

/**
 * Trend direction for KPI changes
 */
export type TrendDirection = 'up' | 'down' | 'stable'

/**
 * Change type for UI display
 */
export type ChangeType = 'increase' | 'decrease'

/**
 * KPI trend information for UI
 */
export interface KPITrendUI {
  change: number
  changeType: ChangeType
  previousValue: number
}

// ============================================================================
// Dashboard Types (UI)
// ============================================================================

/**
 * Dashboard KPIs for UI display
 */
export interface DashboardKPIsUI {
  // Values
  callsMade: number
  contactRate: number
  smsSent: number
  messagesSent: number
  paymentsCollected: number
  paymentsCount: number
  paymentsVerified: number
  paymentsPending: number
  paymentsAverage: number
  paymentsLargest: number

  // Trends
  callsTrend: KPITrendUI
  contactRateTrend: KPITrendUI
  smsTrend: KPITrendUI
  messagesTrend: KPITrendUI
  paymentsTrend: KPITrendUI
}

/**
 * Top operator for UI display
 */
export interface TopOperatorUI {
  operatorId: number
  operatorName: string
  callsMade: number
  contactRate: number
  smsSent: number
  messagesSent: number
}

/**
 * Dashboard data for UI
 */
export interface DashboardUI {
  projectId: number
  period: Period
  generatedAt: string
  kpis: DashboardKPIsUI
  topOperators: TopOperatorUI[]
  paymentMethods?: Array<{
    method: string
    count: number
    amount: number
    percentage: number
  }>
}

// ============================================================================
// Operator Performance Types (UI)
// ============================================================================

/**
 * Daily breakdown for operator (UI)
 */
export interface DailyBreakdownUI {
  date: string
  calls: number
  answered: number
  contactRate: number
  talkTime: number
  talkTimeFormatted: string
  smsSent: number
  payments: number
}

/**
 * Operator summary for UI
 */
export interface OperatorSummaryUI {
  totalCalls: number
  callsAnswered: number
  contactRate: number
  totalTalkTime: number
  totalTalkTimeFormatted: string
  avgCallDuration: number
  avgCallDurationFormatted: string
  smsSent: number
  messagesSent: number
  paymentsCollected: number
  paymentsCount: number
}

/**
 * Operator performance for UI (used in table)
 */
export interface OperatorPerformanceUI {
  operatorId: number
  operatorName: string
  summary: OperatorSummaryUI
  dailyBreakdown: DailyBreakdownUI[]
  comparisonToAverage?: Record<string, number>
}

/**
 * Team average for UI
 */
export interface TeamAverageUI {
  totalCalls: number
  contactRate: number
  avgCallDuration: number
  avgCallDurationFormatted: string
  smsSent: number
  paymentsCollected: number
}

/**
 * Operator performance response for UI
 */
export interface OperatorPerformanceResponseUI {
  projectId: number
  dateRange: {
    from: string
    to: string
  }
  operators: OperatorPerformanceUI[]
  teamAverage?: TeamAverageUI
  generatedAt: string
}

// ============================================================================
// Client Statistics Types (UI)
// ============================================================================

/**
 * Client group for UI
 */
export interface ClientGroupUI {
  name: string
  count: number
  percentage: number
  totalDebt: number
  avgDebt: number
}

/**
 * Client statistics for UI
 */
export interface ClientStatisticsUI {
  projectId: number
  groupBy: 'status' | 'priority' | 'city' | 'debt_range'
  totalClients: number
  totalDebt: number
  averageDebt: number
  groups: ClientGroupUI[]
  generatedAt: string
}

// ============================================================================
// Communication Statistics Types (UI)
// ============================================================================

/**
 * Call statistics for UI
 */
export interface CallStatisticsUI {
  totalCalls: number
  answered: number
  noAnswer: number
  busy: number
  failed: number
  contactRate: number
  totalTalkTime: number
  totalTalkTimeFormatted: string
  avgCallDuration: number
  avgCallDurationFormatted: string
}

/**
 * SMS statistics for UI
 */
export interface SMSStatisticsUI {
  totalSent: number
  delivered: number
  failed: number
  deliveryRate: number
}

/**
 * Top messaging draft for UI
 */
export interface MessagingDraftUI {
  name: string
  count: number
  cost: number
}

/**
 * Messaging statistics for UI (parallel to SMSStatisticsUI)
 */
export interface MessagingStatisticsUI {
  totalSent: number
  delivered: number
  failed: number
  deliveryRate: number
  byChannel: Record<string, number>
  topDrafts: MessagingDraftUI[]
}

/**
 * Hourly breakdown entry for UI (hours already converted to local time)
 */
export interface HourlyBreakdownUI {
  /** Local hour label e.g. "09:00-10:00" */
  label: string
  calls: number
  callsAnswered: number
}

/**
 * Daily trend for UI
 */
export interface DailyTrendUI {
  date: string
  calls: number
  callsAnswered: number
  smsSent: number
  smsDelivered: number
  messagesSent: number
  messagesDelivered: number
}

/**
 * Communication statistics for UI
 */
export interface CommunicationStatisticsUI {
  projectId: number
  dateRange: {
    from: string
    to: string
  }
  callStatistics: CallStatisticsUI
  smsStatistics: SMSStatisticsUI
  messagingStatistics: MessagingStatisticsUI
  /** Hourly breakdown with hours converted to local time. Empty when no data. */
  hourlyBreakdown: HourlyBreakdownUI[]
  dailyTrends: DailyTrendUI[]
  generatedAt: string
}

// ============================================================================
// Agent Performance Table Types (for existing component)
// ============================================================================

/**
 * Agent performance row for AgentPerformanceTable component
 */
export interface AgentPerformanceRow {
  id: string
  operator: string
  calls: number
  contactRate: number
  avgDuration: string
  sms: number
  messages: number
  payments: number
}
