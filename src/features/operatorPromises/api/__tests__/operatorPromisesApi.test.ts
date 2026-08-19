/**
 * Module-level coverage for the operator-promises API wrapper. Every feature
 * test mocks `getOperatorPromisesReport` itself, so the endpoint path and the
 * params passthrough are pinned HERE — a typo in the URL or a key silently
 * renamed on the way to axios would otherwise ship green.
 * (Precedent: communicationGap/api/__tests__/communicationGapFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperatorPromisesReportResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getOperatorPromisesReport } from '../operatorPromisesApi'

describe('getOperatorPromisesReport', () => {
  const response: OperatorPromisesReportResponse = {
    project_id: 1,
    date_from: '2026-07-01',
    date_to: '2026-07-31',
    timezone: 'Europe/Kyiv',
    rows: [],
    totals: {
      operators: 0,
      interactions_count: 0,
      sum_from: '0',
      sum_to: '0',
      paid_full: '0',
      paid_verified: '0',
      unpaid: '0',
      conversion: null,
      verified_unpaid: '0',
      verified_conversion: null,
    },
    generated_at: '2026-08-18T13:20:31.400543Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the operator-promises report endpoint with the full params verbatim', async () => {
    await getOperatorPromisesReport({
      project_id: 1,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/operator-promises', {
      params: {
        project_id: 1,
        date_from: '2026-07-01',
        date_to: '2026-07-31',
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('passes an absent timezone through as a genuinely ABSENT key', async () => {
    // The caller (useOperatorPromisesReport) builds the omission — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently, so the shape is
    // pinned strictly. The backend then defaults to UTC, which is a DIFFERENT
    // report (`sum_to` moved 112 545 ₴ on the July 2026 window).
    await getOperatorPromisesReport({
      project_id: 1,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({
      project_id: 1,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(
      getOperatorPromisesReport({ project_id: 1, date_from: '2026-07-01', date_to: '2026-07-31' })
    ).resolves.toBe(response)
  })
})
