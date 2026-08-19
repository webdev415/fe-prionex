/**
 * Module-level coverage for the communication-gap feed API wrapper. Every
 * feature test mocks `getCommunicationGapFeed` itself, so the endpoint path and
 * the params passthrough are pinned HERE — a typo in the URL or a key silently
 * renamed on the way to axios would otherwise ship green.
 * (Precedent: searcherFollowup/api/__tests__/searcherFollowupFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunicationGapFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getCommunicationGapFeed } from '../communicationGapFeedApi'

describe('getCommunicationGapFeed', () => {
  const response: CommunicationGapFeedResponse = {
    project_id: 1,
    sell_from: '2026-07-01',
    sell_to: '2026-07-31',
    gap_min: 10,
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-08-17T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the communication-gap feed endpoint with the full params verbatim', async () => {
    await getCommunicationGapFeed({
      project_id: 1,
      sell_from: '2026-07-01',
      sell_to: '2026-07-31',
      gap_min: 10,
      skip: 50,
      limit: 50,
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/communication-gap', {
      params: {
        project_id: 1,
        sell_from: '2026-07-01',
        sell_to: '2026-07-31',
        gap_min: 10,
        skip: 50,
        limit: 50,
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('passes absent optional params through as genuinely ABSENT keys', async () => {
    // The caller (useCommunicationGapFeed) builds the omission — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently, so the shape is
    // pinned strictly.
    await getCommunicationGapFeed({ project_id: 1 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1 })
  })

  it('forwards gap_min=0 rather than dropping the falsy value', async () => {
    await getCommunicationGapFeed({ project_id: 1, gap_min: 0 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1, gap_min: 0 })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getCommunicationGapFeed({ project_id: 1 })).resolves.toBe(response)
  })
})
