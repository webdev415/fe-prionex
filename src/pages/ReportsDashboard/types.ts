/**
 * Report Dashboard Page Types
 *
 * Type definitions matching the Report Service API specification.
 * These types will be used when the actual API is implemented.
 */

/**
 * Dashboard API Response
 * GET /api/reports/dashboard
 */
export interface DashboardResponse {
  project_id: number
  project_name: string
  date: string
  generated_at: string
  kpis: DashboardKPIs
  client_stats: ClientStatistics
  top_operators: TopOperator[]
}

export interface DashboardKPIs {
  total_clients: number
  new_clients_today: number
  active_operators: number
  calls_today: number
  calls_answered: number
  calls_no_answer: number
  calls_failed: number
  contact_rate: number
  sms_sent_today: number
  sms_delivered: number
  payments_collected_today: number
  payments_count_today: number
  payments_verified: number
  payments_pending: number
  avg_payment_amount: string
  total_talk_time: number
  avg_call_duration: number
}

export interface ClientStatistics {
  by_status: Record<string, number>
  by_priority: Record<string, number>
  total_debt: string
  avg_debt?: string
}

export interface TopOperator {
  operator_name: string
  calls_made: number
  contact_rate: number
}

/**
 * Operator Performance API Response
 * GET /api/reports/operator-performance
 */
export interface OperatorPerformanceResponse {
  project_id: number
  date_range: {
    from: string
    to: string
  }
  operators: OperatorPerformance[]
}

export interface OperatorPerformance {
  operator_id: number
  operator_name: string
  summary: OperatorSummary
  daily_breakdown?: DailyBreakdown[]
}

export interface OperatorSummary {
  total_calls: number
  calls_answered: number
  contact_rate: number
  total_talk_time: number
  avg_call_duration: number
  sms_sent: number
  unique_clients_contacted: number
  payments_collected?: number
  payments_count?: number
}

export interface DailyBreakdown {
  date: string
  calls: number
  answered: number
  contact_rate: number
  talk_time: number
}

/**
 * Communication Statistics API Response
 * GET /api/reports/communication-statistics
 */
export interface CommunicationStatisticsResponse {
  project_id: number
  date_range: {
    from: string
    to: string
  }
  calls: CallStatistics
  sms: SmsStatistics
  trends?: CommunicationTrend[]
}

export interface CallStatistics {
  total: number
  answered: number
  no_answer: number
  busy: number
  failed: number
  contact_rate: number
  total_talk_time: number
  avg_call_duration: number
}

export interface SmsStatistics {
  total_sent: number
  delivered: number
  failed: number
  delivery_rate: number
  total_cost: number
  avg_cost_per_sms: number
}

export interface CommunicationTrend {
  date: string
  calls: number
  calls_answered: number
  sms_sent: number
}

/**
 * Period type for date filtering
 */
export type Period = 'today' | 'thisWeek' | 'thisMonth' | 'custom'

/**
 * Helper type for KPI change calculation
 */
export interface KPIChange {
  value: number
  change: number
  changeType: 'increase' | 'decrease'
}
