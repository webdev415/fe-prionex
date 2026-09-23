/**
 * Modal data hooks — board #1326 (D3), #1333 (D9, FE part), #1327 (D4, FE part).
 *
 * The three source hooks are mocked, so these tests pin what the modal hooks
 * DERIVE from them, not the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
  CommunicationStatisticsUI,
  DashboardUI,
  OperatorPerformanceResponseUI,
  OperatorPerformanceUI,
} from '../../types'
import { transformCommunicationStatistics } from '../../utils/transformers'

const sources = vi.hoisted(() => ({
  dashboard: undefined as unknown,
  operators: undefined as unknown,
  communication: undefined as unknown,
}))

function queryResult(data: unknown) {
  return { data, isLoading: false, error: null, refetch: vi.fn() }
}

vi.mock('../useDashboard', () => ({
  useDashboard: () => queryResult(sources.dashboard),
}))
vi.mock('../useOperatorPerformance', () => ({
  useOperatorPerformance: () => queryResult(sources.operators),
}))
vi.mock('../useCommunicationStatistics', () => ({
  useCommunicationStatistics: () => queryResult(sources.communication),
}))

import { useCallsMadeModal, useContactRateModal } from '../useModalData'

const trend = { change: 0, changeType: 'increase' as const, previousValue: 0 }

function dashboard(callsMade: number, contactRate = 20): DashboardUI {
  return {
    projectId: 1,
    period: 'today',
    generatedAt: '2026-09-21T10:00:00Z',
    kpis: {
      callsMade,
      contactRate,
      smsSent: 0,
      messagesSent: 0,
      paymentsCollected: 0,
      paymentsCount: 0,
      paymentsVerified: 0,
      paymentsPending: 0,
      paymentsAverage: 0,
      paymentsLargest: 0,
      callsTrend: trend,
      contactRateTrend: trend,
      smsTrend: trend,
      messagesTrend: trend,
      paymentsTrend: trend,
    },
    topOperators: [],
  }
}

function operator(
  operatorId: number,
  operatorName: string,
  totalCalls: number,
  contactRate: number
): OperatorPerformanceUI {
  return {
    operatorId,
    operatorName,
    summary: {
      totalCalls,
      callsAnswered: Math.round((totalCalls * contactRate) / 100),
      contactRate,
      totalTalkTime: 0,
      totalTalkTimeFormatted: '00:00',
      avgCallDuration: 0,
      avgCallDurationFormatted: '00:00',
      smsSent: 0,
      messagesSent: 0,
      paymentsCollected: 0,
      paymentsCount: 0,
    },
    dailyBreakdown: [],
  }
}

function operatorResponse(operators: OperatorPerformanceUI[]): OperatorPerformanceResponseUI {
  return {
    projectId: 1,
    dateRange: { from: '2026-09-21', to: '2026-09-21' },
    operators,
    generatedAt: '2026-09-21T10:00:00Z',
  }
}

/** Built through the real transformer from a report-service-shaped payload. */
function communication(hourly: { hour: number; calls: number }[]): CommunicationStatisticsUI {
  return transformCommunicationStatistics({
    project_id: 1,
    date_range: { from_date: '2026-09-21', to_date: '2026-09-21' },
    call_statistics: {
      total_calls: 0,
      calls_answered: 0,
      calls_no_answer: 0,
      calls_busy: 0,
      calls_failed: 0,
      contact_rate: 0,
      total_talk_time: 0,
      avg_call_duration: 0,
    },
    sms_statistics: { total_sent: 0, delivered: 0, failed: 0, delivery_rate: 0 },
    hourly_breakdown: hourly.map((h) => ({ ...h, calls_answered: 0, sms_sent: 0 })),
    generated_at: '2026-09-21T10:00:00Z',
  })
}

beforeEach(() => {
  sources.dashboard = undefined
  sources.operators = undefined
  sources.communication = undefined
})

describe('useCallsMadeModal', () => {
  it('fills «По годинах» from report-service hourly rows (D9 #1333)', () => {
    sources.dashboard = dashboard(30)
    sources.operators = operatorResponse([])
    sources.communication = communication([
      { hour: 6, calls: 10 },
      { hour: 7, calls: 20 },
      { hour: 8, calls: 0 },
    ])

    const { result } = renderHook(() =>
      useCallsMadeModal({ projectId: 1, period: 'today', userTimezone: 'UTC' })
    )

    expect(result.current.data?.byHour).toEqual([
      { label: '06:00-07:00', calls: 10 },
      { label: '07:00-08:00', calls: 20 },
    ])
  })

  it('exposes the operator-list sum next to the header total (D4 #1327)', () => {
    // Header = dashboard KPI; list = operator performance — different sources.
    sources.dashboard = dashboard(8365)
    sources.operators = operatorResponse([
      operator(1, 'Olena', 5000, 20),
      operator(2, 'Petro', 3321, 19),
    ])
    sources.communication = communication([])

    const { result } = renderHook(() =>
      useCallsMadeModal({ projectId: 1, period: 'today', userTimezone: 'UTC' })
    )

    expect(result.current.data?.total).toBe(8365)
    expect(result.current.data?.operatorsTotal).toBe(8321)
    expect(result.current.data?.byOperator.map((o) => o.calls)).toEqual([5000, 3321])
  })

  it('reports equal totals when the header falls back to the operator sum', () => {
    sources.dashboard = dashboard(0)
    sources.operators = operatorResponse([operator(1, 'Olena', 40, 20)])
    sources.communication = communication([])

    const { result } = renderHook(() =>
      useCallsMadeModal({ projectId: 1, period: 'today', userTimezone: 'UTC' })
    )

    expect(result.current.data?.total).toBe(40)
    expect(result.current.data?.operatorsTotal).toBe(40)
  })
})

describe('useContactRateModal ranking (D3 #1326)', () => {
  it('does not show 0-call operators as «needs improvement»', () => {
    sources.dashboard = dashboard(200, 25)
    sources.operators = operatorResponse([
      operator(1, 'Admin', 0, 0),
      operator(2, 'Olena', 120, 30),
      operator(3, 'Petro', 80, 18),
      operator(7499, 'Analyst', 0, 0),
    ])
    sources.communication = communication([])

    const { result } = renderHook(() =>
      useContactRateModal({ projectId: 1, period: 'today', userTimezone: 'UTC' })
    )

    expect(result.current.data?.bestPerformer).toEqual({ name: 'Olena', rate: 30 })
    expect(result.current.data?.needsImprovement).toEqual({ name: 'Petro', rate: 18 })
  })

  it('shows neither when nobody made enough calls', () => {
    sources.dashboard = dashboard(12, 25)
    sources.operators = operatorResponse([
      operator(1, 'Admin', 0, 0),
      operator(2, 'Olena', 7, 43),
      operator(3, 'Petro', 5, 0),
    ])
    sources.communication = communication([])

    const { result } = renderHook(() =>
      useContactRateModal({ projectId: 1, period: 'today', userTimezone: 'UTC' })
    )

    expect(result.current.data?.bestPerformer).toBeNull()
    expect(result.current.data?.needsImprovement).toBeNull()
  })
})
