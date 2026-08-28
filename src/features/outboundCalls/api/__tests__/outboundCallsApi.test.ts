/**
 * Module-level coverage for the outbound-calls API wrapper. The tab test mocks
 * `getOutboundCallsReport` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed on
 * the way to axios would otherwise ship green.
 * (Precedent: operatorPromises/api/__tests__/operatorPromisesApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutboundCallsReportResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getOutboundCallsReport } from '../outboundCallsApi'

describe('getOutboundCallsReport', () => {
  const response: OutboundCallsReportResponse = {
    project_id: 1,
    date_start: '2026-08-27',
    date_end: '2026-08-27',
    timezone: 'Europe/Kyiv',
    rows: [],
    generated_at: '2026-08-27T13:20:31.400543Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the outbound-calls report endpoint with the full params verbatim', async () => {
    await getOutboundCallsReport({
      project_id: 1,
      date_start: '2026-08-01',
      date_end: '2026-08-27',
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/outbound-calls', {
      params: {
        project_id: 1,
        date_start: '2026-08-01',
        date_end: '2026-08-27',
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('passes an absent timezone through as a genuinely ABSENT key', async () => {
    // The caller (useOutboundCallsReport) builds the omission — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently. The backend then
    // defaults to UTC, which cuts different calendar days.
    await getOutboundCallsReport({
      project_id: 1,
      date_start: '2026-08-01',
      date_end: '2026-08-27',
    })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({
      project_id: 1,
      date_start: '2026-08-01',
      date_end: '2026-08-27',
    })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(
      getOutboundCallsReport({ project_id: 1, date_start: '2026-08-27', date_end: '2026-08-27' })
    ).resolves.toBe(response)
  })
})
