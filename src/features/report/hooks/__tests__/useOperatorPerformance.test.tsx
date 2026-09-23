/**
 * Operator performance table hook — board #1332 (D8 / AC#2).
 *
 * report-service's `top_collector` has to reach the dashboard with null and
 * undefined kept apart: `null` hides the «top collector» tile, while only an
 * absent key (an older backend) lets the page fall back to its own pick. The
 * page tests stub this hook, so these tests pin the hook itself, with only the
 * network (`reportApi`) mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type {
  BackendOperatorPerformance,
  BackendOperatorPerformanceResponse,
} from '../../api/types'

vi.mock('../../api/reportApi', () => ({
  reportApi: {
    getOperatorPerformance: vi.fn(),
  },
}))

import { useAgentPerformanceTable } from '../useOperatorPerformance'
import { reportApi } from '../../api/reportApi'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function backendOperator(
  operatorId: number,
  operatorName: string,
  paymentsCollected: number | string,
  rankingEligible?: boolean | null
): BackendOperatorPerformance {
  return {
    operator_id: operatorId,
    operator_name: operatorName,
    summary: {
      total_calls: 0,
      calls_answered: 0,
      contact_rate: 0,
      total_talk_time: 0,
      avg_call_duration: 0,
      sms_sent: 0,
      payments_collected: paymentsCollected,
      payments_count: 1,
    },
    daily_breakdown: [],
    ...(rankingEligible === undefined ? {} : { ranking_eligible: rankingEligible }),
  }
}

function response(
  extra: Partial<BackendOperatorPerformanceResponse> = {}
): BackendOperatorPerformanceResponse {
  return {
    project_id: 1,
    date_range: { from_date: '2026-09-23', to_date: '2026-09-23' },
    operators: [
      backendOperator(1, 'Administrator System', '84947.75', false),
      backendOperator(7234, 'Collector', '22600.00', true),
    ],
    generated_at: '2026-09-23T10:00:00Z',
    ...extra,
  }
}

async function renderTable() {
  const { result } = renderHook(
    () =>
      useAgentPerformanceTable({
        projectId: 1,
        fromDate: '2026-09-23',
        toDate: '2026-09-23',
        timezone: 'Europe/Kyiv',
      }),
    { wrapper: createWrapper() }
  )

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  return result
}

describe('useAgentPerformanceTable — top collector (D8 #1332 AC#2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("hands over report-service's top collector with a parsed amount", async () => {
    vi.mocked(reportApi.getOperatorPerformance).mockResolvedValue(
      response({
        top_collector: {
          operator_id: 7234,
          operator_name: 'Collector',
          payments_collected: '22600.50',
          payments_count: 3,
        },
      })
    )

    const result = await renderTable()

    expect(result.current.topCollector).toEqual({
      operatorId: 7234,
      operatorName: 'Collector',
      paymentsCollected: 22_600.5,
      paymentsCount: 3,
    })
    expect(
      result.current.data?.map((row) => [row.operator, row.payments, row.rankingEligible])
    ).toEqual([
      ['Administrator System', 84_947.75, false],
      ['Collector', 22_600, true],
    ])
  })

  it('keeps top_collector null, so the page hides the tile', async () => {
    vi.mocked(reportApi.getOperatorPerformance).mockResolvedValue(response({ top_collector: null }))

    const result = await renderTable()

    expect(result.current.topCollector).toBeNull()
    expect(result.current.data).toHaveLength(2)
  })

  it('leaves topCollector undefined when an older backend does not send the key', async () => {
    vi.mocked(reportApi.getOperatorPerformance).mockResolvedValue(
      response({
        operators: [
          backendOperator(1, 'Administrator System', '84947.75'),
          backendOperator(7234, 'Collector', '22600.00'),
        ],
      })
    )

    const result = await renderTable()

    expect(result.current.topCollector).toBeUndefined()
    expect(result.current.data?.map((row) => row.rankingEligible)).toEqual([undefined, undefined])
  })
})
