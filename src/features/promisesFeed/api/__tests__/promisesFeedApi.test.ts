/**
 * Module-level coverage for the promises feed API wrapper. Every feature test
 * mocks `getPromisesFeed` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed
 * on the way to axios would otherwise ship green.
 * (Precedent: searcherFollowup/api/__tests__/searcherFollowupFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromisesFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getPromisesFeed } from '../promisesFeedApi'

describe('getPromisesFeed', () => {
  const response: PromisesFeedResponse = {
    project_id: 1,
    date_from: '2026-09-08',
    date_to: '2026-09-08',
    hide_worked: false,
    hide_paid: false,
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-09-08T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the promises feed endpoint with the full params verbatim', async () => {
    await getPromisesFeed({
      project_id: 1,
      date_from: '2026-09-08',
      date_to: '2026-09-08',
      timezone: 'Europe/Kyiv',
      hide_worked: true,
      hide_paid: true,
      skip: 50,
      limit: 50,
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/promises', {
      params: {
        project_id: 1,
        date_from: '2026-09-08',
        date_to: '2026-09-08',
        timezone: 'Europe/Kyiv',
        hide_worked: true,
        hide_paid: true,
        skip: 50,
        limit: 50,
      },
    })
  })

  it('passes absent optional params through as genuinely ABSENT keys', async () => {
    // The caller (usePromisesFeed) builds the omission — this module must
    // forward the object untouched: an `undefined`-valued key would still pass
    // a loose toEqual but could serialise differently, so the shape is pinned
    // strictly.
    await getPromisesFeed({ project_id: 1 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1 })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getPromisesFeed({ project_id: 1 })).resolves.toBe(response)
  })
})
