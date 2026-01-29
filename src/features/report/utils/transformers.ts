/**
 * Data Transformers
 *
 * Transform backend API responses to frontend UI format.
 * This keeps the UI components decoupled from backend structure changes.
 */

import type {
  BackendDashboardResponse,
  BackendOperatorPerformanceResponse,
  BackendClientStatisticsResponse,
  BackendCommunicationStatisticsResponse,
  KPITrend,
} from '../api/types'

import type {
  Period,
  BackendPeriod,
  ChangeType,
  KPITrendUI,
  DashboardUI,
  TopOperatorUI,
  OperatorPerformanceResponseUI,
  OperatorPerformanceUI,
  DailyBreakdownUI,
  TeamAverageUI,
  ClientStatisticsUI,
  ClientGroupUI,
  CommunicationStatisticsUI,
  CallStatisticsUI,
  SMSStatisticsUI,
  DailyTrendUI,
  AgentPerformanceRow,
} from '../types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map frontend period to backend period format
 */
export function mapPeriodToBackend(period: Period): BackendPeriod {
  const periodMap: Record<Period, BackendPeriod> = {
    today: 'today',
    thisWeek: 'this_week',
    thisMonth: 'this_month',
  }
  return periodMap[period]
}

/**
 * Map backend period to frontend period format
 */
export function mapPeriodToFrontend(period: string): Period {
  const periodMap: Record<string, Period> = {
    today: 'today',
    this_week: 'thisWeek',
    this_month: 'thisMonth',
  }
  return periodMap[period] || 'today'
}

/**
 * Convert trend direction to change type for UI
 */
export function trendToChangeType(direction: 'up' | 'down' | 'stable'): ChangeType {
  return direction === 'down' ? 'decrease' : 'increase'
}

/**
 * Transform backend trend to UI trend
 */
export function transformTrend(trend: KPITrend): KPITrendUI {
  return {
    change: Math.abs(trend.change),
    changeType: trendToChangeType(trend.direction),
    previousValue: trend.previous_value,
  }
}

/**
 * Format seconds to duration string (e.g., "5:30" or "1:15:30")
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '0:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse string or number to number
 */
export function parseNumber(value: string | number): number {
  if (typeof value === 'number') return value
  return parseFloat(value) || 0
}

// ============================================================================
// Dashboard Transformer
// ============================================================================

/**
 * Transform backend dashboard response to UI format
 */
export function transformDashboard(data: BackendDashboardResponse): DashboardUI {
  const payments = data.kpis.payments_collected
  return {
    projectId: data.project_id,
    period: mapPeriodToFrontend(data.period),
    generatedAt: data.generated_at,
    kpis: {
      callsMade: data.kpis.calls_made.value,
      contactRate: data.kpis.contact_rate.value,
      smsSent: data.kpis.sms_sent.value,
      paymentsCollected: parseNumber(payments.total_amount),
      paymentsCount: payments.payment_count || 0,
      paymentsVerified: parseNumber(payments.verified_amount || 0),
      paymentsPending: parseNumber(payments.pending_amount || 0),
      paymentsAverage: parseNumber(payments.average_amount || 0),

      callsTrend: transformTrend(data.kpis.calls_made.trend),
      contactRateTrend: transformTrend(data.kpis.contact_rate.trend),
      smsTrend: transformTrend(data.kpis.sms_sent.trend),
      paymentsTrend: transformTrend(payments.trend),
    },
    topOperators: data.top_operators.map(transformTopOperator),
  }
}

/**
 * Transform top operator
 */
function transformTopOperator(op: BackendDashboardResponse['top_operators'][0]): TopOperatorUI {
  return {
    operatorId: op.operator_id,
    operatorName: op.operator_name,
    callsMade: op.calls_made,
    contactRate: op.contact_rate,
  }
}

// ============================================================================
// Operator Performance Transformer
// ============================================================================

/**
 * Transform backend operator performance to UI format
 */
export function transformOperatorPerformance(
  data: BackendOperatorPerformanceResponse
): OperatorPerformanceResponseUI {
  return {
    projectId: data.project_id,
    dateRange: {
      from: data.date_range.from_date,
      to: data.date_range.to_date,
    },
    operators: data.operators.map(transformOperator),
    teamAverage: data.team_average
      ? transformTeamAverage(data.team_average)
      : undefined,
    generatedAt: data.generated_at,
  }
}

/**
 * Transform individual operator
 */
function transformOperator(
  op: BackendOperatorPerformanceResponse['operators'][0]
): OperatorPerformanceUI {
  return {
    operatorId: op.operator_id,
    operatorName: op.operator_name,
    summary: {
      totalCalls: op.summary.total_calls,
      callsAnswered: op.summary.calls_answered,
      contactRate: op.summary.contact_rate,
      totalTalkTime: op.summary.total_talk_time,
      totalTalkTimeFormatted: formatDuration(op.summary.total_talk_time),
      avgCallDuration: op.summary.avg_call_duration,
      avgCallDurationFormatted: formatDuration(op.summary.avg_call_duration),
      smsSent: op.summary.sms_sent,
      paymentsCollected: parseNumber(op.summary.payments_collected),
      paymentsCount: op.summary.payments_count,
    },
    dailyBreakdown: op.daily_breakdown.map(transformDailyBreakdown),
    comparisonToAverage: op.comparison_to_average,
  }
}

/**
 * Transform daily breakdown
 */
function transformDailyBreakdown(
  day: BackendOperatorPerformanceResponse['operators'][0]['daily_breakdown'][0]
): DailyBreakdownUI {
  return {
    date: day.date,
    calls: day.calls,
    answered: day.answered,
    contactRate: day.contact_rate,
    talkTime: day.talk_time,
    talkTimeFormatted: formatDuration(day.talk_time),
    smsSent: day.sms_sent,
    payments: parseNumber(day.payments),
  }
}

/**
 * Transform team average
 */
function transformTeamAverage(
  avg: NonNullable<BackendOperatorPerformanceResponse['team_average']>
): TeamAverageUI {
  return {
    totalCalls: avg.total_calls,
    contactRate: avg.contact_rate,
    avgCallDuration: avg.avg_call_duration,
    avgCallDurationFormatted: formatDuration(avg.avg_call_duration),
    smsSent: avg.sms_sent,
    paymentsCollected: parseNumber(avg.payments_collected),
  }
}

/**
 * Transform operators to table format for AgentPerformanceTable
 */
export function transformToAgentPerformanceRows(
  operators: OperatorPerformanceUI[]
): AgentPerformanceRow[] {
  return operators.map((op) => ({
    id: op.operatorId.toString(),
    operator: op.operatorName,
    calls: op.summary.totalCalls,
    contactRate: op.summary.contactRate,
    avgDuration: op.summary.avgCallDurationFormatted,
    sms: op.summary.smsSent,
    payments: op.summary.paymentsCollected,
  }))
}

// ============================================================================
// Client Statistics Transformer
// ============================================================================

/**
 * Transform backend client statistics to UI format
 */
export function transformClientStatistics(
  data: BackendClientStatisticsResponse
): ClientStatisticsUI {
  return {
    projectId: data.project_id,
    groupBy: data.group_by,
    totalClients: data.total_clients,
    totalDebt: parseNumber(data.total_debt),
    averageDebt: parseNumber(data.average_debt),
    groups: data.groups.map(transformClientGroup),
    generatedAt: data.generated_at,
  }
}

/**
 * Transform client group
 */
function transformClientGroup(
  group: BackendClientStatisticsResponse['groups'][0]
): ClientGroupUI {
  return {
    name: group.name,
    count: group.count,
    percentage: group.percentage,
    totalDebt: parseNumber(group.total_debt),
    avgDebt: parseNumber(group.avg_debt),
  }
}

// ============================================================================
// Communication Statistics Transformer
// ============================================================================

/**
 * Transform backend communication statistics to UI format
 */
export function transformCommunicationStatistics(
  data: BackendCommunicationStatisticsResponse
): CommunicationStatisticsUI {
  return {
    projectId: data.project_id,
    dateRange: {
      from: data.date_range.from_date,
      to: data.date_range.to_date,
    },
    callStatistics: transformCallStatistics(data.call_statistics),
    smsStatistics: transformSMSStatistics(data.sms_statistics),
    dailyTrends: (data.daily_trends || []).map(transformDailyTrend),
    generatedAt: data.generated_at,
  }
}

/**
 * Transform call statistics
 */
function transformCallStatistics(
  stats: BackendCommunicationStatisticsResponse['call_statistics']
): CallStatisticsUI {
  return {
    totalCalls: stats.total_calls,
    answered: stats.calls_answered,
    noAnswer: stats.calls_no_answer,
    busy: stats.calls_busy,
    failed: stats.calls_failed,
    contactRate: stats.contact_rate,
    totalTalkTime: stats.total_talk_time,
    totalTalkTimeFormatted: formatDuration(stats.total_talk_time),
    avgCallDuration: stats.avg_call_duration,
    avgCallDurationFormatted: formatDuration(stats.avg_call_duration),
  }
}

/**
 * Transform SMS statistics
 */
function transformSMSStatistics(
  stats: BackendCommunicationStatisticsResponse['sms_statistics']
): SMSStatisticsUI {
  return {
    totalSent: stats.total_sent,
    delivered: stats.delivered,
    failed: stats.failed,
    deliveryRate: stats.delivery_rate,
  }
}

/**
 * Transform daily trend
 */
function transformDailyTrend(
  trend: NonNullable<BackendCommunicationStatisticsResponse['daily_trends']>[0]
): DailyTrendUI {
  return {
    date: trend.date,
    calls: trend.calls,
    callsAnswered: trend.calls_answered,
    smsSent: trend.sms_sent,
    smsDelivered: trend.sms_delivered,
  }
}
