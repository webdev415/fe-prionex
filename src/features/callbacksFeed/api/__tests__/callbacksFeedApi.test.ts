/**
 * Module-level coverage for the callbacks feed API wrapper. Every feature test
 * mocks `getCallbacksFeed` itself, so the endpoint path and the params
 * passthrough are pinned HERE — a typo in the URL or a key silently renamed
 * on the way to axios would otherwise ship green.
 * (Precedent: promisesFeed/api/__tests__/promisesFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CallbacksFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getCallbacksFeed } from '../callbacksFeedApi'

describe('getCallbacksFeed', () => {
  const response: CallbacksFeedResponse = {
    project_id: 1,
    date_from: '2026-09-09',
    date_to: '2026-09-09',
    hide_called_today: false,
    hide_worked: false,
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-09-09T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the callbacks feed endpoint with the full params verbatim', async () => {
    await getCallbacksFeed({
      project_id: 1,
      date_from: '2026-09-09',
      date_to: '2026-09-09',
      timezone: 'Europe/Kyiv',
      hide_called_today: true,
      hide_worked: true,
      skip: 50,
      limit: 50,
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/callbacks', {
      params: {
        project_id: 1,
        date_from: '2026-09-09',
        date_to: '2026-09-09',
        timezone: 'Europe/Kyiv',
        hide_called_today: true,
        hide_worked: true,
        skip: 50,
        limit: 50,
      },
    })
  })

  it('passes absent optional params through as genuinely ABSENT keys', async () => {
    // The caller (useCallbacksFeed) builds the omission — this module must
    // forward the object untouched: an `undefined`-valued key would still pass
    // a loose toEqual but could serialise differently, so the shape is pinned
    // strictly.
    await getCallbacksFeed({ project_id: 1 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1 })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getCallbacksFeed({ project_id: 1 })).resolves.toBe(response)
  })
})
