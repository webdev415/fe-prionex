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
  BackendHourlyBreakdown,
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
  MessagingStatisticsUI,
  HourlyBreakdownUI,
  DailyTrendUI,
  AgentPerformanceRow,
} from '../types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map frontend period to backend period format
 *
 * @param period - Frontend period value (camelCase)
 * @returns Backend period string (snake_case)
 *
 * @example
 * ```typescript
 * mapPeriodToBackend('thisWeek') // Returns: 'this_week'
 * mapPeriodToBackend('today')    // Returns: 'today'
 * ```
 */
export function mapPeriodToBackend(period: Period): BackendPeriod {
  const periodMap: Record<Period, BackendPeriod> = {
    today: 'today',
    thisWeek: 'this_week',
    thisMonth: 'this_month',
    custom: 'custom',
  }
  return periodMap[period]
}

/**
 * Map backend period to frontend period format
 *
 * @param period - Backend period string (snake_case)
 * @returns Frontend period value (camelCase)
 *
 * @example
 * ```typescript
 * mapPeriodToFrontend('this_week') // Returns: 'thisWeek'
 * mapPeriodToFrontend('today')     // Returns: 'today'
 * ```
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
 *
 * @param direction - Backend trend direction
 * @returns UI change type
 *
 * @example
 * ```typescript
 * trendToChangeType('up')     // Returns: 'increase'
 * trendToChangeType('down')   // Returns: 'decrease'
 * trendToChangeType('stable') // Returns: 'increase'
 * ```
 */
export function trendToChangeType(direction: 'up' | 'down' | 'stable'): ChangeType {
  return direction === 'down' ? 'decrease' : 'increase'
}

/**
 * Transform backend trend data to UI format
 *
 * @param trend - Backend KPI trend data
 * @returns UI-formatted trend data
 *
 * @example
 * ```typescript
 * transformTrend({
 *   direction: 'up',
 *   change: 15.5,
 *   previous_value: 100
 * })
 * // Returns: {
 * //   change: 15.5,
 * //   changeType: 'increase',
 * //   previousValue: 100
 * // }
 * ```
 */
export function transformTrend(trend: KPITrend): KPITrendUI {
  return {
    change: Math.abs(trend.change),
    changeType: trendToChangeType(trend.direction),
    previousValue: trend.previous_value,
  }
}

/**
 * Format seconds to duration string
 *
 * Formats seconds into human-readable duration with the following formats:
 * - Less than 1 hour: "MM:SS" (e.g., "05:30")
 * - 1 hour or more: "H:MM:SS" (e.g., "1:15:30")
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(65)    // Returns: "01:05"
 * formatDuration(125)   // Returns: "02:05"
 * formatDuration(3665)  // Returns: "1:01:05"
 * formatDuration(0)     // Returns: "00:00"
 * formatDuration(-10)   // Returns: "00:00"
 * ```
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '00:00'
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
 *
 * Safely converts string or number to number type. Returns 0 for invalid inputs.
 *
 * @param value - Value to parse (string or number)
 * @returns Parsed number or 0 if invalid
 *
 * @example
 * ```typescript
 * parseNumber('123.45')  // Returns: 123.45
 * parseNumber(456)       // Returns: 456
 * parseNumber('invalid') // Returns: 0
 * parseNumber('')        // Returns: 0
 * ```
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
 *
 * Converts the backend dashboard data structure to a frontend-friendly format.
 * Handles period mapping, payment data parsing, and operator transformations.
 *
 * @param data - Backend dashboard response
 * @returns UI-formatted dashboard data
 *
 * @example
 * ```typescript
 * transformDashboard({
 *   project_id: 1,
 *   period: 'this_week',
 *   generated_at: '2024-01-01T00:00:00Z',
 *   kpis: {
 *     calls_made: { value: 1000, trend: {...} },
 *     contact_rate: { value: 65.5, trend: {...} },
 *     sms_sent: { value: 500, trend: {...} },
 *     payments_collected: {
 *       total_amount: '15000.00',
 *       payment_count: 50,
 *       trend: {...}
 *     }
 *   },
 *   top_operators: [...]
 * })
 * // Returns: DashboardUI with camelCase properties
 * ```
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
      messagesSent: data.kpis.messages_sent?.value ?? 0,
      paymentsCollected: parseNumber(payments.total_amount),
      paymentsCount: payments.payment_count || 0,
      paymentsVerified: parseNumber(payments.verified_amount || 0),
      paymentsPending: parseNumber(payments.pending_amount || 0),
      paymentsAverage: parseNumber(payments.average_amount || 0),
      paymentsLargest: parseNumber(payments.largest_amount || 0),

      callsTrend: transformTrend(data.kpis.calls_made.trend),
      contactRateTrend: transformTrend(data.kpis.contact_rate.trend),
      smsTrend: transformTrend(data.kpis.sms_sent.trend),
      messagesTrend: transformTrend(data.kpis.messages_sent?.trend),
      paymentsTrend: transformTrend(payments.trend),
    },
    topOperators: data.top_operators.map(transformTopOperator),
    paymentMethods: (data.payment_method_breakdown || []).map((method) => ({
      method: method.method,
      count: method.count,
      amount: parseNumber(method.amount),
      percentage: method.percentage,
    })),
  }
}

/**
 * Transform top operator from backend to UI format
 *
 * Converts backend operator data to frontend format with camelCase properties.
 *
 * @param op - Backend top operator data
 * @returns UI-formatted top operator
 *
 * @example
 * ```typescript
 * transformTopOperator({
 *   operator_id: 5,
 *   operator_name: 'John Doe',
 *   calls_made: 150,
 *   contact_rate: 72.5
 * })
 * // Returns: {
 * //   operatorId: 5,
 * //   operatorName: 'John Doe',
 * //   callsMade: 150,
 * //   contactRate: 72.5
 * // }
 * ```
 */
function transformTopOperator(op: BackendDashboardResponse['top_operators'][0]): TopOperatorUI {
  return {
    operatorId: op.operator_id,
    operatorName: op.operator_name,
    callsMade: op.calls_made,
    contactRate: op.contact_rate,
    smsSent: op.sms_sent ?? 0,
    messagesSent: op.messages_sent ?? 0,
  }
}

// ============================================================================
// Operator Performance Transformer
// ============================================================================

/**
 * Transform backend operator performance to UI format
 *
 * Converts comprehensive operator performance data including daily breakdowns,
 * team averages, and individual metrics to frontend format.
 *
 * @param data - Backend operator performance response
 * @returns UI-formatted operator performance data
 *
 * @example
 * ```typescript
 * transformOperatorPerformance({
 *   project_id: 1,
 *   date_range: { from_date: '2024-01-01', to_date: '2024-01-07' },
 *   operators: [...],
 *   team_average: {...},
 *   generated_at: '2024-01-08T00:00:00Z'
 * })
 * // Returns: OperatorPerformanceResponseUI with formatted dates and durations
 * ```
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
    teamAverage: data.team_average ? transformTeamAverage(data.team_average) : undefined,
    generatedAt: data.generated_at,
  }
}

/**
 * Transform individual operator performance data
 *
 * Converts operator metrics including calls, SMS, payments, and daily breakdowns.
 * Automatically formats duration fields using formatDuration().
 *
 * @param op - Backend operator data
 * @returns UI-formatted operator performance
 *
 * @example
 * ```typescript
 * transformOperator({
 *   operator_id: 5,
 *   operator_name: 'John Doe',
 *   summary: {
 *     total_calls: 200,
 *     total_talk_time: 7200, // seconds
 *     avg_call_duration: 36,
 *     ...
 *   },
 *   daily_breakdown: [...],
 *   comparison_to_average: {...}
 * })
 * // Returns: Operator data with formatted durations (e.g., "02:00:00")
 * ```
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
      messagesSent: op.summary.messages_sent ?? 0,
      paymentsCollected: parseNumber(op.summary.payments_collected),
      paymentsCount: op.summary.payments_count,
    },
    dailyBreakdown: op.daily_breakdown.map(transformDailyBreakdown),
    comparisonToAverage: op.comparison_to_average,
  }
}

/**
 * Transform daily breakdown data for an operator
 *
 * Converts daily metrics to UI format with formatted durations.
 *
 * @param day - Backend daily breakdown data
 * @returns UI-formatted daily breakdown
 *
 * @example
 * ```typescript
 * transformDailyBreakdown({
 *   date: '2024-01-01',
 *   calls: 50,
 *   answered: 35,
 *   contact_rate: 70.0,
 *   talk_time: 1800,
 *   sms_sent: 20,
 *   payments: '500.00'
 * })
 * // Returns: {
 * //   date: '2024-01-01',
 * //   calls: 50,
 * //   talkTimeFormatted: '30:00',
 * //   ...
 * // }
 * ```
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
 * Transform team average metrics
 *
 * Converts aggregated team performance data to UI format.
 *
 * @param avg - Backend team average data
 * @returns UI-formatted team average
 *
 * @example
 * ```typescript
 * transformTeamAverage({
 *   avg_calls: 180.5,
 *   avg_contact_rate: 68.2,
 *   avg_talk_time: 6500,
 *   avg_call_duration: 36,
 *   avg_sms_sent: 25.5,
 *   avg_payments: '450.00'
 * })
 * // Returns: Team averages with formatted durations
 * ```
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
 * Transform operators to table row format for AgentPerformanceTable
 *
 * Converts operator performance data to simplified row format for table display.
 *
 * @param operators - Array of operator performance data
 * @returns Array of agent performance table rows
 *
 * @example
 * ```typescript
 * transformToAgentPerformanceRows([
 *   {
 *     operatorId: 5,
 *     operatorName: 'John Doe',
 *     summary: {
 *       totalCalls: 200,
 *       contactRate: 72.5,
 *       avgCallDurationFormatted: '02:30',
 *       smsSent: 50,
 *       paymentsCollected: 1500
 *     },
 *     ...
 *   }
 * ])
 * // Returns: [{
 * //   id: '5',
 * //   operator: 'John Doe',
 * //   calls: 200,
 * //   contactRate: 72.5,
 * //   avgDuration: '02:30',
 * //   sms: 50,
 * //   payments: 1500
 * // }]
 * ```
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
    messages: op.summary.messagesSent,
    payments: op.summary.paymentsCollected,
  }))
}

// ============================================================================
// Client Statistics Transformer
// ============================================================================

/**
 * Transform backend client statistics to UI format
 *
 * Converts client grouping data (by status, priority, city, debt range) to UI format.
 * Parses debt amounts and calculates percentages.
 *
 * @param data - Backend client statistics response
 * @returns UI-formatted client statistics
 *
 * @example
 * ```typescript
 * transformClientStatistics({
 *   project_id: 1,
 *   group_by: 'status',
 *   total_clients: 1000,
 *   total_debt: '500000.00',
 *   average_debt: '500.00',
 *   groups: [
 *     { name: 'active', count: 600, percentage: 60.0, total_debt: '300000.00', avg_debt: '500.00' },
 *     { name: 'inactive', count: 400, percentage: 40.0, total_debt: '200000.00', avg_debt: '500.00' }
 *   ],
 *   generated_at: '2024-01-01T00:00:00Z'
 * })
 * // Returns: ClientStatisticsUI with parsed debt numbers
 * ```
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
 * Transform client group data
 *
 * Converts individual group metrics with debt parsing.
 *
 * @param group - Backend client group data
 * @returns UI-formatted client group
 *
 * @example
 * ```typescript
 * transformClientGroup({
 *   name: 'high_priority',
 *   count: 250,
 *   percentage: 25.0,
 *   total_debt: '125000.00',
 *   avg_debt: '500.00'
 * })
 * // Returns: {
 * //   name: 'high_priority',
 * //   count: 250,
 * //   percentage: 25.0,
 * //   totalDebt: 125000,
 * //   avgDebt: 500
 * // }
 * ```
 */
function transformClientGroup(group: BackendClientStatisticsResponse['groups'][0]): ClientGroupUI {
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
 *
 * Converts call and SMS statistics including daily trends.
 * Formats all duration fields automatically.
 *
 * @param data - Backend communication statistics response
 * @returns UI-formatted communication statistics
 *
 * @example
 * ```typescript
 * transformCommunicationStatistics({
 *   project_id: 1,
 *   date_range: { from_date: '2024-01-01', to_date: '2024-01-07' },
 *   call_statistics: {
 *     total_calls: 1000,
 *     calls_answered: 650,
 *     total_talk_time: 18000,
 *     avg_call_duration: 27.69,
 *     ...
 *   },
 *   sms_statistics: {
 *     total_sent: 500,
 *     delivered: 475,
 *     ...
 *   },
 *   daily_trends: [...],
 *   generated_at: '2024-01-08T00:00:00Z'
 * })
 * // Returns: CommunicationStatisticsUI with formatted durations
 * ```
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
    messagingStatistics: transformMessagingStatistics(data.messaging_statistics),
    hourlyBreakdown: (data.hourly_breakdown || []).map(transformHourlyBreakdown),
    dailyTrends: (data.daily_trends || []).map(transformDailyTrend),
    generatedAt: data.generated_at,
  }
}

/**
 * Transform call statistics data
 *
 * Converts call metrics with automatic duration formatting.
 *
 * @param stats - Backend call statistics
 * @returns UI-formatted call statistics
 *
 * @example
 * ```typescript
 * transformCallStatistics({
 *   total_calls: 1000,
 *   calls_answered: 650,
 *   calls_no_answer: 200,
 *   calls_busy: 100,
 *   calls_failed: 50,
 *   contact_rate: 65.0,
 *   total_talk_time: 18000,
 *   avg_call_duration: 27.69
 * })
 * // Returns: {
 * //   totalCalls: 1000,
 * //   totalTalkTimeFormatted: "05:00:00",
 * //   avgCallDurationFormatted: "00:27",
 * //   ...
 * // }
 * ```
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
 * Transform SMS statistics data
 *
 * Converts SMS delivery metrics to UI format.
 *
 * @param stats - Backend SMS statistics
 * @returns UI-formatted SMS statistics
 *
 * @example
 * ```typescript
 * transformSMSStatistics({
 *   total_sent: 500,
 *   delivered: 475,
 *   failed: 25,
 *   delivery_rate: 95.0
 * })
 * // Returns: {
 * //   totalSent: 500,
 * //   delivered: 475,
 * //   failed: 25,
 * //   deliveryRate: 95.0
 * // }
 * ```
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

const EMPTY_MESSAGING_STATISTICS: MessagingStatisticsUI = {
  totalSent: 0,
  delivered: 0,
  failed: 0,
  skipped: 0,
  queued: 0,
  inFlight: 0,
  deliveryRate: 0,
  byChannel: {},
  topDrafts: [],
}

function transformMessagingStatistics(
  stats: BackendCommunicationStatisticsResponse['messaging_statistics'] | undefined
): MessagingStatisticsUI {
  if (!stats) {
    return EMPTY_MESSAGING_STATISTICS
  }
  return {
    totalSent: stats.total_sent,
    delivered: stats.delivered,
    failed: stats.failed,
    skipped: stats.skipped ?? 0,
    queued: stats.queued ?? 0,
    inFlight: stats.in_flight ?? 0,
    deliveryRate: stats.delivery_rate,
    byChannel: stats.by_channel ?? {},
    topDrafts: (stats.top_drafts ?? []).map((draft) => ({
      name: draft.name,
      count: draft.count,
      cost: draft.cost ?? 0,
    })),
  }
}

/**
 * Transform daily trend data
 *
 * Converts daily call and SMS metrics to UI format.
 *
 * @param trend - Backend daily trend data
 * @returns UI-formatted daily trend
 *
 * @example
 * ```typescript
 * transformDailyTrend({
 *   date: '2024-01-01',
 *   calls: 150,
 *   calls_answered: 95,
 *   sms_sent: 75,
 *   sms_delivered: 72
 * })
 * // Returns: {
 * //   date: '2024-01-01',
 * //   calls: 150,
 * //   callsAnswered: 95,
 * //   smsSent: 75,
 * //   smsDelivered: 72
 * // }
 * ```
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
    messagesSent: trend.messages_sent ?? 0,
    messagesDelivered: trend.messages_delivered ?? 0,
  }
}

/**
 * Transform a single hourly breakdown entry.
 * The backend stores UTC hours; conversion to local time is handled
 * in the hook using the user's timezone.
 */
function transformHourlyBreakdown(entry: BackendHourlyBreakdown): HourlyBreakdownUI {
  const h = entry.hour
  const label = `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`
  return {
    label,
    calls: entry.calls_made,
    callsAnswered: entry.calls_answered,
  }
}
