/**
 * Module-level coverage for the inbound follow-up feed API wrapper. Every
 * feature test mocks `getInboundFollowupFeed` itself, so the endpoint path
 * and the params passthrough are pinned HERE — a typo in the URL or a key
 * silently renamed on the way to axios would otherwise ship green. And the
 * path is one dash away from the sibling feed's, which makes it exactly the
 * kind of copy-paste a mocked suite cannot see.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InboundFollowupResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getInboundFollowupFeed } from '../inboundFollowupFeedApi'

describe('getInboundFollowupFeed', () => {
  const response: InboundFollowupResponse = {
    project_id: 1,
    date_start: '2026-08-25',
    date_end: '2026-08-25',
    rows: [],
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-08-25T09:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the inbound-followup feed endpoint with the full params verbatim', async () => {
    await getInboundFollowupFeed({
      project_id: 1,
      date_start: '2026-08-25',
      date_end: '2026-08-25',
      skip: 50,
      limit: 50,
      timezone: 'Europe/Kyiv',
    })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/clients/reports/feeds/inbound-followup', {
      params: {
        project_id: 1,
        date_start: '2026-08-25',
        date_end: '2026-08-25',
        skip: 50,
        limit: 50,
        timezone: 'Europe/Kyiv',
      },
    })
  })

  it('passes absent optional params through as genuinely ABSENT keys', async () => {
    // The caller (useInboundFollowupFeed) builds the omission — this module
    // must forward the object untouched: an `undefined`-valued key would still
    // pass a loose toEqual but could serialise differently, so the shape is
    // pinned strictly. Both bounds absent is the backend's whole-history mode.
    await getInboundFollowupFeed({ project_id: 1 })

    const [, config] = mockApi.get.mock.calls[0]
    expect(config.params).toStrictEqual({ project_id: 1 })
  })

  it('returns the response body (response.data), not the axios envelope', async () => {
    await expect(getInboundFollowupFeed({ project_id: 1 })).resolves.toBe(response)
  })

  it('parses a contract-shaped row without reshaping any field', async () => {
    // The wire contract (services/client/app/schemas/inbound_followup_feed.py):
    // UTC instants as ISO strings, the interaction type as a free label, the
    // call outcome as the RAW enum, every enrichment field nullable.
    const wire: InboundFollowupResponse = {
      project_id: 1,
      date_start: '2026-08-25',
      date_end: '2026-08-25',
      rows: [
        {
          client_id: 84213,
          inn: '1234567890',
          interaction_at: '2026-08-25T06:14:03Z',
          interaction_type: 'Питання щодо спец.пропозицій',
          employee_id: 6959,
          employee_name: 'Коваленко Іван Петрович',
          department: 'ТП',
          group_name: 'Група №1',
          last_call_at: null,
          last_call_outcome: null,
        },
      ],
      total: 3,
      page: 1,
      page_size: 50,
      total_pages: 1,
      generated_at: '2026-08-25T09:00:00Z',
    }
    mockApi.get.mockResolvedValue({ data: wire })

    const result = await getInboundFollowupFeed({ project_id: 1 })

    expect(result).toStrictEqual(wire)
    // The raw outcome is NOT translated on the way in — that is the table's job
    // (and the reason the API ships it raw at all).
    expect(result.rows[0].last_call_outcome).toBeNull()
    expect(result.rows[0].interaction_at).toBe('2026-08-25T06:14:03Z')
  })
})
