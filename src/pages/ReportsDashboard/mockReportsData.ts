/**
 * Mock Reports Data
 *
 * Mock data matching the Report Service API specification.
 * This data structure matches what the actual API will return.
 * TODO: Replace with actual API calls when Report Service is implemented.
 */

import type {
  DashboardResponse,
  OperatorPerformanceResponse,
  CommunicationStatisticsResponse,
  Period,
} from './types'

/**
 * Get date range for period
 */
export function getDateRange(period: Period): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().split('T')[0]

  switch (period) {
    case 'today':
      return { from: to, to }
    case 'thisWeek': {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      return { from: weekStart.toISOString().split('T')[0], to }
    }
    case 'thisMonth': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: monthStart.toISOString().split('T')[0], to }
    }
  }
}

/**
 * Base operator data - used across all periods
 */
const baseOperators = [
  {
    operator_id: 5,
    operator_name: 'Shevchenko',
    baseCalls: 43,
    baseContactRate: 45,
    baseSMS: 18,
    basePayments: 765,
    baseTalkTime: 485,
  },
  {
    operator_id: 6,
    operator_name: 'Melnik',
    baseCalls: 43,
    baseContactRate: 76,
    baseSMS: 1,
    basePayments: 345,
    baseTalkTime: 272,
  },
  {
    operator_id: 7,
    operator_name: 'Savchenko',
    baseCalls: 7,
    baseContactRate: 91,
    baseSMS: 0,
    basePayments: 901,
    baseTalkTime: 485,
  },
  {
    operator_id: 8,
    operator_name: 'Lysenko',
    baseCalls: 45,
    baseContactRate: 33,
    baseSMS: 78,
    basePayments: 522,
    baseTalkTime: 272,
  },
  {
    operator_id: 9,
    operator_name: 'Hryshchenko',
    baseCalls: 12,
    baseContactRate: 68,
    baseSMS: 50,
    basePayments: 890,
    baseTalkTime: 850,
  },
  {
    operator_id: 10,
    operator_name: 'Kravenko',
    baseCalls: 78,
    baseContactRate: 54,
    baseSMS: 10,
    basePayments: 112,
    baseTalkTime: 610,
  },
  {
    operator_id: 11,
    operator_name: 'Romanenko',
    baseCalls: 46,
    baseContactRate: 27,
    baseSMS: 17,
    basePayments: 340,
    baseTalkTime: 272,
  },
]

/**
 * Generate operator performance for a period
 */
function generateOperatorPerformance(period: Period) {
  const multiplier = period === 'today' ? 1 : period === 'thisWeek' ? 7 : 30

  return baseOperators.map((op) => {
    const totalCalls = op.baseCalls * multiplier
    const callsAnswered = Math.round((totalCalls * op.baseContactRate) / 100)
    const avgCallDuration = callsAnswered > 0 ? Math.round(op.baseTalkTime / callsAnswered) : 0

    return {
      operator_id: op.operator_id,
      operator_name: op.operator_name,
      summary: {
        total_calls: totalCalls,
        calls_answered: callsAnswered,
        contact_rate: op.baseContactRate,
        total_talk_time: op.baseTalkTime * multiplier,
        avg_call_duration: avgCallDuration,
        sms_sent: op.baseSMS * multiplier,
        unique_clients_contacted: Math.round(callsAnswered * 1.2),
        payments_collected: op.basePayments * multiplier,
        payments_count: Math.round((op.basePayments * multiplier) / 3333),
      },
    }
  })
}

/**
 * Mock Dashboard Data
 * GET /api/reports/dashboard
 */
export function getMockDashboard(period: Period = 'today'): DashboardResponse {
  const dateRange = getDateRange(period)
  const multiplier = period === 'today' ? 1 : period === 'thisWeek' ? 7 : 30

  // Base values for today
  const baseKPIs = {
    calls_today: 347,
    calls_answered: 235,
    calls_no_answer: 78,
    calls_failed: 34,
    contact_rate: 67.7,
    sms_sent_today: 124,
    sms_delivered: 119,
    payments_collected_today: 150000.0,
    payments_count_today: 45,
    payments_verified: 120000.0,
    payments_pending: 30000.0,
    avg_payment_amount: 3333.33,
    total_talk_time: 18240,
    avg_call_duration: 78,
  }

  return {
    project_id: 1,
    project_name: 'Project A',
    date: dateRange.to,
    generated_at: new Date().toISOString(),
    kpis: {
      total_clients: 10000,
      new_clients_today: period === 'today' ? 150 : 0,
      active_operators: 8,
      calls_today: Math.round(baseKPIs.calls_today * multiplier),
      calls_answered: Math.round(baseKPIs.calls_answered * multiplier),
      calls_no_answer: Math.round(baseKPIs.calls_no_answer * multiplier),
      calls_failed: Math.round(baseKPIs.calls_failed * multiplier),
      contact_rate: baseKPIs.contact_rate,
      sms_sent_today: Math.round(baseKPIs.sms_sent_today * multiplier),
      sms_delivered: Math.round(baseKPIs.sms_delivered * multiplier),
      payments_collected_today: Math.round(baseKPIs.payments_collected_today * multiplier),
      payments_count_today: Math.round(baseKPIs.payments_count_today * multiplier),
      payments_verified: Math.round(baseKPIs.payments_verified * multiplier),
      payments_pending: Math.round(baseKPIs.payments_pending * multiplier),
      avg_payment_amount: baseKPIs.avg_payment_amount,
      total_talk_time: Math.round(baseKPIs.total_talk_time * multiplier),
      avg_call_duration: baseKPIs.avg_call_duration,
    },
    client_stats: {
      by_status: {
        new: 3200,
        in_progress: 2800,
        contacted: 1500,
        promised_payment: 800,
        paid: 1200,
        unreachable: 300,
        dispute: 150,
        closed: 50,
      },
      by_priority: {
        high: 2500,
        medium: 5000,
        low: 2500,
      },
      total_debt: 125000000.0,
      avg_debt: 12500.0,
    },
    top_operators: [
      {
        operator_name: 'Ivan Dovzhenko',
        calls_made: 52 * multiplier,
        contact_rate: 75.0,
      },
      {
        operator_name: 'Maria Petrenko',
        calls_made: 47 * multiplier,
        contact_rate: 68.1,
      },
      {
        operator_name: 'Petro Shevchenko',
        calls_made: 45 * multiplier,
        contact_rate: 66.7,
      },
    ],
  }
}

/**
 * Mock Operator Performance Data
 * GET /api/reports/operator-performance
 */
export function getMockOperatorPerformance(period: Period = 'today'): OperatorPerformanceResponse {
  const dateRange = getDateRange(period)

  return {
    project_id: 1,
    date_range: dateRange,
    operators: generateOperatorPerformance(period),
  }
}

/**
 * Mock Communication Statistics Data
 * GET /api/reports/communication-statistics
 */
export function getMockCommunicationStatistics(
  period: Period = 'today'
): CommunicationStatisticsResponse {
  const dateRange = getDateRange(period)
  const multiplier = period === 'today' ? 1 : period === 'thisWeek' ? 7 : 30

  const baseCalls = {
    total: 347,
    answered: 235,
    no_answer: 78,
    busy: 25,
    failed: 9,
    contact_rate: 67.7,
    total_talk_time: 18240,
    avg_call_duration: 78,
  }

  const baseSMS = {
    total_sent: 124,
    delivered: 119,
    failed: 5,
    delivery_rate: 95.97,
    total_cost: 9.92,
    avg_cost_per_sms: 0.08,
  }

  return {
    project_id: 1,
    date_range: dateRange,
    calls: {
      total: baseCalls.total * multiplier,
      answered: baseCalls.answered * multiplier,
      no_answer: baseCalls.no_answer * multiplier,
      busy: baseCalls.busy * multiplier,
      failed: baseCalls.failed * multiplier,
      contact_rate: baseCalls.contact_rate,
      total_talk_time: baseCalls.total_talk_time * multiplier,
      avg_call_duration: baseCalls.avg_call_duration,
    },
    sms: {
      total_sent: baseSMS.total_sent * multiplier,
      delivered: baseSMS.delivered * multiplier,
      failed: baseSMS.failed * multiplier,
      delivery_rate: baseSMS.delivery_rate,
      total_cost: baseSMS.total_cost * multiplier,
      avg_cost_per_sms: baseSMS.avg_cost_per_sms,
    },
  }
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '0:00'
  }
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate average duration from multiple durations
 */
export function calculateAverageDuration(durations: number[]): string {
  if (durations.length === 0) return '0:00'
  const total = durations.reduce((sum, d) => sum + d, 0)
  const avg = Math.round(total / durations.length)
  return formatDuration(avg)
}

/**
 * Calculate KPI change (vs previous period)
 * This is a mock calculation - actual API will provide this
 */
export function calculateKPIChange(
  currentValue: number,
  previousValue: number
): { change: number; changeType: 'increase' | 'decrease' } {
  if (previousValue === 0) {
    return { change: 0, changeType: 'increase' }
  }

  const change = Math.round(((currentValue - previousValue) / previousValue) * 100)
  return {
    change: Math.abs(change),
    changeType: change >= 0 ? 'increase' : 'decrease',
  }
}

/**
 * Get previous period KPI values for comparison
 */
export function getPreviousPeriodKPIs(period: Period) {
  const currentDashboard = getMockDashboard(period)

  // For today, compare with yesterday (slightly lower values)
  if (period === 'today') {
    return {
      calls_today: Math.round(currentDashboard.kpis.calls_today * 0.88), // 12% increase
      contact_rate: currentDashboard.kpis.contact_rate + 5, // 5% decrease
      sms_sent_today: Math.round(currentDashboard.kpis.sms_sent_today * 0.88), // 12% increase
    }
  }

  // For thisWeek, compare with last week (slightly lower)
  if (period === 'thisWeek') {
    return {
      calls_today: Math.round(currentDashboard.kpis.calls_today * 0.9),
      contact_rate: currentDashboard.kpis.contact_rate + 2,
      sms_sent_today: Math.round(currentDashboard.kpis.sms_sent_today * 0.9),
    }
  }

  // For thisMonth, compare with last month
  return {
    calls_today: Math.round(currentDashboard.kpis.calls_today * 0.85),
    contact_rate: currentDashboard.kpis.contact_rate + 3,
    sms_sent_today: Math.round(currentDashboard.kpis.sms_sent_today * 0.85),
  }
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: Array<Record<string, unknown>>, filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value ?? ''
        })
        .join(',')
    ),
  ]

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
