/**
 * Module-level coverage for the promises-daily API wrapper. The tab test mocks
 * `getPromisesDailyReport` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed on
 * the way to axios would otherwise ship green.
 * (Precedent: outboundCalls/api/__tests__/outboundCallsApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromisesDailyReportResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getPromisesDailyReport } from '../promisesDailyApi'

describe('getPromisesDailyReport', () => {
  const response: PromisesDailyReportResponse = {
    project_id: 1,
    date_from: '2026-09-07',
    date_to: '2026-09-30',
    timezone: 'Europe/Kyiv',
    possible_payment: false,
    dates: [],
    departments: [],
    total: '0.00',
    generated_at: '2026-09-07T13:20:31.400543Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the promises-daily report endpoint with the full params verbatim', async () => {
    await getPromisesDailyReport({
      project_id: 1,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
      timezone: 'Europe/Kyiv',
      possible_payment: true,
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/promises-daily', {
      params: {
        project_id: 1,
        date_from: '2026-09-01',
        date_to: '2026-09-30',
        timezone: 'Europe/Kyiv',
        possible_payment: true,
      },
    })
  })

  it('passes absent optional keys through as genuinely ABSENT keys', async () => {
    // The caller (usePromisesDailyReport) builds the omissions — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently. The backend then
    // applies its own defaults (UTC; firm agreement subtypes only).
    await getPromisesDailyReport({
      project_id: 1,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({
      project_id: 1,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(
      getPromisesDailyReport({ project_id: 1, date_from: '2026-09-07', date_to: '2026-09-30' })
    ).resolves.toBe(response)
  })
})
