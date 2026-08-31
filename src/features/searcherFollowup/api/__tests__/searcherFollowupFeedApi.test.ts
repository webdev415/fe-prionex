/**
 * Module-level coverage for the searcher follow-up feed API wrapper. Every
 * feature test mocks `getSearcherFollowupFeed` itself, so the endpoint path
 * and the params passthrough are pinned HERE — a typo in the URL or a key
 * silently renamed on the way to axios would otherwise ship green.
 * (Precedent: operatorAnalytics/api/__tests__/operatorAnalyticsService.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearcherFollowupResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getSearcherFollowupFeed } from '../searcherFollowupFeedApi'

describe('getSearcherFollowupFeed', () => {
  const response: SearcherFollowupResponse = {
    project_id: 1,
    date_start: '2026-08-14',
    date_end: '2026-08-14',
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-08-14T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the searcher-followup feed endpoint with the full params verbatim', async () => {
    await getSearcherFollowupFeed({
      project_id: 1,
      date_start: '2026-08-14',
      date_end: '2026-08-14',
      skip: 50,
      limit: 50,
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/searcher-followup', {
      params: {
        project_id: 1,
        date_start: '2026-08-14',
        date_end: '2026-08-14',
        skip: 50,
        limit: 50,
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('passes absent optional params through as genuinely ABSENT keys', async () => {
    // The caller (useSearcherFollowupFeed) builds the omission — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently, so the shape is
    // pinned strictly.
    await getSearcherFollowupFeed({ project_id: 1 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1 })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getSearcherFollowupFeed({ project_id: 1 })).resolves.toBe(response)
  })
})
