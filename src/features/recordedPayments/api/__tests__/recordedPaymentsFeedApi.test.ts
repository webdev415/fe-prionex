/**
 * Module-level coverage for the recorded payments feed API wrapper. Every
 * feature test mocks `getRecordedPaymentsFeed` itself, so the endpoint path
 * and the query-string construction are pinned HERE — the repeated-key
 * spelling of `user_ids` in particular, which is invisible from the tab.
 * (Precedent: drainsFeed/api/__tests__/drainsFeedApi.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordedPaymentsFeedResponse } from '../types'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { buildRecordedPaymentsFeedQuery, getRecordedPaymentsFeed } from '../recordedPaymentsFeedApi'

describe('getRecordedPaymentsFeed', () => {
  const response: RecordedPaymentsFeedResponse = {
    project_id: 1,
    date_from: '2026-08-01',
    date_to: '2026-08-31',
    timezone: 'Europe/Kyiv',
    verified_only: false,
    user_ids: [],
    rows: [],
    summary: { rows_count: 0, total_amount: '0' },
    operator_breakdown: [],
    breakdown_capped: false,
    breakdown_truncated: false,
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 0,
    generated_at: '2026-09-29T10:15:31.400543Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: response })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hits the PAYMENT-service feed endpoint and returns the payload', async () => {
    const result = await getRecordedPaymentsFeed({ project_id: 1, skip: 0, limit: 50 })

    expect(mockApi.get).toHaveBeenCalledTimes(1)
    const [url, config] = mockApi.get.mock.calls[0]
    expect(url).toBe('/api/v1/payments/reports/feeds/recorded-payments')
    expect(config.params).toBeInstanceOf(URLSearchParams)
    expect(result).toBe(response)
  })

  it('spells user_ids as REPEATED bare keys — the form FastAPI reads a list from', () => {
    // axios' default would write `user_ids[]=101&user_ids[]=102`, which FastAPI
    // does not read as `user_ids` at all: the filter would silently not apply.
    const query = buildRecordedPaymentsFeedQuery({
      project_id: 1,
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      timezone: 'Europe/Kyiv',
      user_ids: [101, 102],
      verified_only: true,
      skip: 50,
      limit: 50,
    })
    expect(query.toString()).toBe(
      'project_id=1&date_from=2026-08-01&date_to=2026-08-31&timezone=Europe%2FKyiv&user_ids=101&user_ids=102&verified_only=true&skip=50&limit=50'
    )
    expect(query.getAll('user_ids')).toEqual(['101', '102'])
    expect(query.has('user_ids[]')).toBe(false)
  })

  it('leaves an omitted date, filter or flag ABSENT rather than empty', () => {
    // `date_from=` is a PRESENT parameter to FastAPI and earns a 400 for a
    // half-specified window; `user_ids=` would be a 422.
    const query = buildRecordedPaymentsFeedQuery({ project_id: 1, skip: 0, limit: 50 })
    expect(query.toString()).toBe('project_id=1&skip=0&limit=50')
    for (const key of ['date_from', 'date_to', 'timezone', 'user_ids', 'verified_only']) {
      expect(query.has(key)).toBe(false)
    }
  })
})
