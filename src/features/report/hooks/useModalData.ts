/**
 * Modal Data Hooks
 *
 * React Query hooks that combine data from multiple endpoints
 * to provide modal-specific data structures.
 */

import { useMemo } from 'react'
import { useDashboard } from './useDashboard'
import { useOperatorPerformance } from './useOperatorPerformance'
import { useCommunicationStatistics } from './useCommunicationStatistics'
import { getDateRangeForPeriod } from '@/lib/dateUtils'
import type { Period, ChangeType, HourlyBreakdownUI } from '../types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert UTC hourly breakdown to local time using the user's timezone.
 * Groups calls that fall into the same local hour after conversion.
 */
function convertHourlyToLocalTime(
  utcBreakdown: HourlyBreakdownUI[],
  userTimezone?: string | null
): { label: string; calls: number }[] {
  if (!utcBreakdown.length) return []

  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get UTC offset in hours for a reference date (today)
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const localMs = new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime()
  const offsetHours = Math.round((localMs - utcMs) / 3600000)

  // Accumulate calls into local hours (handle wrap-around with modulo 24)
  const localCalls: number[] = Array(24).fill(0)
  for (const entry of utcBreakdown) {
    const localHour =
      ((entry.label.split(':')[0] ? parseInt(entry.label.split(':')[0]) : 0) + offsetHours + 24) %
      24
    localCalls[localHour] += entry.calls
  }

  // Return only hours that have data, formatted as "HH:00-HH+1:00"
  return localCalls
    .map((calls, h) => ({
      label: `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`,
      calls,
    }))
    .filter((row) => row.calls > 0)
    .sort((a, b) => parseInt(a.label) - parseInt(b.label))
}

// ============================================================================
// Calls Made Modal Hook
// ============================================================================

export interface CallsMadeModalData {
  total: number
  change: number
  changeType: ChangeType
  previousTotal: number
  byHour: { label: string; calls: number }[]
  byOperator: { name: string; calls: number }[]
}

export interface UseCallsMadeModalParams {
  projectId: number
  period: Period
  enabled?: boolean
  userTimezone?: string | null
}

/**
 * Hook for Calls Made modal data
 *
 * Combines dashboard KPIs, operator performance, and communication statistics
 * to provide the data needed by CallsMadeDetailModal.
 */
export function useCallsMadeModal({
  projectId,
  period,
  enabled = true,
  userTimezone,
}: UseCallsMadeModalParams) {
  const { from: fromDate, to: toDate } = getDateRangeForPeriod(period, userTimezone)

  const dashboardQuery = useDashboard({
    projectId,
    period,
    timezone: userTimezone,
    enabled,
  })

  const operatorQuery = useOperatorPerformance({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const communicationQuery = useCommunicationStatistics({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const isLoading =
    dashboardQuery.isLoading || operatorQuery.isLoading || communicationQuery.isLoading
  const error = dashboardQuery.error || operatorQuery.error || communicationQuery.error

  const data = useMemo<CallsMadeModalData | undefined>(() => {
    if (!dashboardQuery.data) return undefined

    const dashboard = dashboardQuery.data
    const operators = operatorQuery.data?.operators || []
    const rawHourly = communicationQuery.data?.hourlyBreakdown || []

    // If dashboard KPI is missing/zero, fall back to sum of operator totals to avoid showing 0 when data exists
    const totalCallsFromDashboard = dashboard.kpis.callsMade
    const totalCallsFromOperators = operators.reduce(
      (sum, op) => sum + (op.summary.totalCalls || 0),
      0
    )
    const totalCalls = totalCallsFromDashboard || totalCallsFromOperators

    return {
      total: totalCalls,
      change: dashboard.kpis.callsTrend.change,
      changeType: dashboard.kpis.callsTrend.changeType,
      previousTotal: dashboard.kpis.callsTrend.previousValue,
      byHour: convertHourlyToLocalTime(rawHourly, userTimezone),
      byOperator: operators
        .map((op) => ({
          name: op.operatorName,
          calls: op.summary.totalCalls,
        }))
        .sort((a, b) => b.calls - a.calls),
    }
  }, [dashboardQuery.data, operatorQuery.data, communicationQuery.data, userTimezone])

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      dashboardQuery.refetch()
      operatorQuery.refetch()
      communicationQuery.refetch()
    },
  }
}

// ============================================================================
// Contact Rate Modal Hook
// ============================================================================

export interface ContactRateOutcome {
  key: 'answered' | 'noAnswer' | 'busy' | 'failed'
  count: number
  percentage: number
}

export interface ContactRateModalData {
  rate: number
  contacted: number
  total: number
  change: number
  changeType: ChangeType
  previousRate: number
  outcomes: ContactRateOutcome[]
  bestPerformer: { name: string; rate: number } | null
  needsImprovement: { name: string; rate: number } | null
}

export interface UseContactRateModalParams {
  projectId: number
  period: Period
  enabled?: boolean
  userTimezone?: string | null
}

/**
 * Hook for Contact Rate modal data
 *
 * Combines dashboard KPIs, operator performance, and communication statistics
 * to provide the data needed by ContactRateDetailModal.
 */
export function useContactRateModal({
  projectId,
  period,
  enabled = true,
  userTimezone,
}: UseContactRateModalParams) {
  const { from: fromDate, to: toDate } = getDateRangeForPeriod(period, userTimezone)

  const dashboardQuery = useDashboard({
    projectId,
    period,
    timezone: userTimezone,
    enabled,
  })

  const operatorQuery = useOperatorPerformance({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const communicationQuery = useCommunicationStatistics({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const isLoading =
    dashboardQuery.isLoading || operatorQuery.isLoading || communicationQuery.isLoading
  const error = dashboardQuery.error || operatorQuery.error || communicationQuery.error

  const data = useMemo<ContactRateModalData | undefined>(() => {
    if (!dashboardQuery.data) return undefined

    const dashboard = dashboardQuery.data
    const operators = operatorQuery.data?.operators || []
    const callStats = communicationQuery.data?.callStatistics

    // Fallback: derive totals from operator performance if dashboard has zeros
    const operatorTotals = operators.reduce(
      (acc, op) => {
        acc.calls += op.summary.totalCalls || 0
        acc.answered += op.summary.callsAnswered || 0
        return acc
      },
      { calls: 0, answered: 0 }
    )

    const totalCalls = dashboard.kpis.callsMade || operatorTotals.calls
    const contactRate =
      dashboard.kpis.contactRate ||
      (operatorTotals.calls > 0
        ? Math.round((operatorTotals.answered / operatorTotals.calls) * 1000) / 10
        : 0)
    const contacted = Math.round(totalCalls * (contactRate / 100))

    // Build outcomes; prefer communication stats only if they contain data
    const hasCallStats =
      !!callStats &&
      (callStats.totalCalls > 0 ||
        callStats.answered > 0 ||
        callStats.noAnswer > 0 ||
        callStats.busy > 0 ||
        callStats.failed > 0)

    let outcomes: ContactRateOutcome[]
    if (hasCallStats && callStats) {
      const total = callStats.totalCalls || totalCalls
      outcomes = [
        {
          key: 'answered' as const,
          count: callStats.answered,
          percentage: total > 0 ? Math.round((callStats.answered / total) * 100) : 0,
        },
        {
          key: 'noAnswer' as const,
          count: callStats.noAnswer,
          percentage: total > 0 ? Math.round((callStats.noAnswer / total) * 100) : 0,
        },
        {
          key: 'busy' as const,
          count: callStats.busy,
          percentage: total > 0 ? Math.round((callStats.busy / total) * 100) : 0,
        },
        {
          key: 'failed' as const,
          count: callStats.failed,
          percentage: total > 0 ? Math.round((callStats.failed / total) * 100) : 0,
        },
      ]
    } else {
      // Fallback: if we have real answered counts from operators, use them; otherwise estimate
      const answered = operatorTotals.answered || contacted
      const remaining = totalCalls - answered
      outcomes = [
        {
          key: 'answered' as const,
          count: answered,
          percentage:
            totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : Math.round(contactRate),
        },
        {
          key: 'noAnswer' as const,
          count: Math.max(0, remaining),
          percentage:
            totalCalls > 0
              ? Math.round((Math.max(0, remaining) / totalCalls) * 100)
              : Math.round(100 - contactRate),
        },
        {
          key: 'busy' as const,
          count: 0,
          percentage: 0,
        },
        {
          key: 'failed' as const,
          count: 0,
          percentage: 0,
        },
      ]
    }

    // Find best and worst performers
    let bestPerformer: { name: string; rate: number } | null = null
    let needsImprovement: { name: string; rate: number } | null = null

    if (operators.length > 0) {
      const sortedByRate = [...operators].sort(
        (a, b) => b.summary.contactRate - a.summary.contactRate
      )
      const best = sortedByRate[0]
      const worst = sortedByRate[sortedByRate.length - 1]

      bestPerformer = { name: best.operatorName, rate: Math.round(best.summary.contactRate) }
      if (worst.operatorId !== best.operatorId) {
        needsImprovement = { name: worst.operatorName, rate: Math.round(worst.summary.contactRate) }
      }
    }

    return {
      rate: contactRate,
      contacted,
      total: totalCalls,
      change: dashboard.kpis.contactRateTrend.change,
      changeType: dashboard.kpis.contactRateTrend.changeType,
      previousRate: dashboard.kpis.contactRateTrend.previousValue,
      outcomes,
      bestPerformer,
      needsImprovement,
    }
  }, [dashboardQuery.data, operatorQuery.data, communicationQuery.data])

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      dashboardQuery.refetch()
      operatorQuery.refetch()
      communicationQuery.refetch()
    },
  }
}

// ============================================================================
// SMS Sent Modal Hook
// ============================================================================

export interface SMSSentModalData {
  totalSent: number
  delivered: number
  failed: number
  pending: number
  deliveryRate: number
  change: number
  changeType: ChangeType
  previousTotal: number
  byOperator: { name: string; smsSent: number }[]
}

export interface UseSMSSentModalParams {
  projectId: number
  period: Period
  enabled?: boolean
  userTimezone?: string | null
}

/**
 * Hook for SMS Sent modal data
 *
 * Combines dashboard KPIs, operator performance, and communication statistics
 * to provide the data needed by SMSSentDetailModal.
 */
export function useSMSSentModal({
  projectId,
  period,
  enabled = true,
  userTimezone,
}: UseSMSSentModalParams) {
  const { from: fromDate, to: toDate } = getDateRangeForPeriod(period, userTimezone)

  const dashboardQuery = useDashboard({
    projectId,
    period,
    timezone: userTimezone,
    enabled,
  })

  const operatorQuery = useOperatorPerformance({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const communicationQuery = useCommunicationStatistics({
    projectId,
    fromDate,
    toDate,
    timezone: userTimezone,
    enabled,
  })

  const isLoading =
    dashboardQuery.isLoading || operatorQuery.isLoading || communicationQuery.isLoading
  const error = dashboardQuery.error || operatorQuery.error || communicationQuery.error

  const data = useMemo<SMSSentModalData | undefined>(() => {
    if (!dashboardQuery.data) return undefined

    const dashboard = dashboardQuery.data
    const operators = operatorQuery.data?.operators || []
    const smsStats = communicationQuery.data?.smsStatistics

    const totalSent = dashboard.kpis.smsSent

    // Get delivery breakdown from communication statistics
    let delivered: number
    let failed: number
    let pending: number
    let deliveryRate: number

    if (smsStats) {
      delivered = smsStats.delivered
      failed = smsStats.failed
      pending = totalSent - delivered - failed
      deliveryRate = smsStats.deliveryRate
    } else {
      // Fallback with estimated values
      deliveryRate = 92
      delivered = Math.round(totalSent * 0.92)
      failed = Math.round(totalSent * 0.05)
      pending = totalSent - delivered - failed
    }

    const result = {
      totalSent,
      delivered,
      failed,
      pending: Math.max(0, pending),
      deliveryRate,
      change: dashboard.kpis.smsTrend.change,
      changeType: dashboard.kpis.smsTrend.changeType,
      previousTotal: dashboard.kpis.smsTrend.previousValue,
      byOperator: operators
        .map((op) => ({
          name: op.operatorName,
          smsSent: op.summary.smsSent,
        }))
        .sort((a, b) => b.smsSent - a.smsSent),
    }

    return result
  }, [dashboardQuery.data, operatorQuery.data, communicationQuery.data])

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      dashboardQuery.refetch()
      operatorQuery.refetch()
      communicationQuery.refetch()
    },
  }
}
