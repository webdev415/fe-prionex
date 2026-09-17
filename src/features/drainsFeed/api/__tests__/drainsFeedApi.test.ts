/**
 * Module-level coverage for the drains feed API wrapper. Every feature test
 * mocks `getDrainsFeed` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed on
 * the way to axios would otherwise ship green.
 * (Precedent: callbacksFeed/api/__tests__/callbacksFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrainsFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getDrainsFeed } from '../drainsFeedApi'

describe('getDrainsFeed', () => {
  const response: DrainsFeedResponse = {
    project_id: 1,
    date_from: '2026-09-11',
    date_to: '2026-09-13',
    hide_worked_today: false,
    hide_worked: false,
    hide_paid: false,
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-09-14T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the drains feed endpoint with the full params verbatim', async () => {
    await getDrainsFeed({
      project_id: 1,
      date_from: '2026-09-11',
      date_to: '2026-09-13',
      timezone: 'Europe/Kyiv',
      hide_worked_today: true,
      hide_worked: true,
      hide_paid: true,
      skip: 50,
      limit: 50,
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/drains', {
      params: {
        project_id: 1,
        date_from: '2026-09-11',
        date_to: '2026-09-13',
        timezone: 'Europe/Kyiv',
        hide_worked_today: true,
        hide_worked: true,
        hide_paid: true,
        skip: 50,
        limit: 50,
      },
    })
  })

  it('passes the all-history request through with NO date keys at all', async () => {
    // The mode that separates this endpoint from every sibling: both dates
    // absent means the whole history. The caller (useDrainsFeed) builds the
    // omission — this module must forward the object untouched, because an
    // `undefined`-valued key would still pass a loose toEqual while axios
    // serialises it away (or, worse, ships `date_from=` and earns a 400 for a
    // half-specified window). Hence a strict shape check.
    await getDrainsFeed({
      project_id: 1,
      timezone: 'Europe/Kyiv',
      skip: 0,
      limit: 50,
    })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({
      project_id: 1,
      timezone: 'Europe/Kyiv',
      skip: 0,
      limit: 50,
    })
    expect('date_from' in config.params).toBe(false)
    expect('date_to' in config.params).toBe(false)
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getDrainsFeed({ project_id: 1 })).resolves.toBe(response)
  })
})
