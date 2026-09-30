import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useRecordedPaymentsFeed } from '../useRecordedPaymentsFeed'
import { getRecordedPaymentsFeed } from '../../api/recordedPaymentsFeedApi'
import type { RecordedPaymentsFeedResponse } from '../../types'

vi.mock('../../api/recordedPaymentsFeedApi', () => ({
  getRecordedPaymentsFeed: vi.fn(),
}))

const mockGetFeed = vi.mocked(getRecordedPaymentsFeed)

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
  generated_at: '2026-09-29T10:15:31Z',
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFeed.mockResolvedValue(response)
})
afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * The hook's own gate — the SECOND line behind the tab's `enabled`. A half
 * window must produce ZERO requests, not the server's default month behind
 * the tab's back; a whole one goes out with exactly the keys that differ from
 * the backend defaults.
 */
describe('useRecordedPaymentsFeed', () => {
  it.each([
    ['a lower bound only', { dateFrom: '2026-08-01', dateTo: undefined }],
    ['an upper bound only', { dateFrom: undefined, dateTo: '2026-08-31' }],
    ['no bounds at all', { dateFrom: undefined, dateTo: undefined }],
  ])('sends NOTHING with %s, even when the caller says enabled', async (_case, window) => {
    const { result } = renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          ...window,
          skip: 0,
          limit: 50,
          timezone: 'Europe/Kyiv',
          enabled: true,
        }),
      { wrapper }
    )
    await settle()
    expect(mockGetFeed).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('stays idle when the caller disables it (an unusable bound on the tab)', async () => {
    renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          skip: 0,
          limit: 50,
          enabled: false,
        }),
      { wrapper }
    )
    await settle()
    expect(mockGetFeed).not.toHaveBeenCalled()
  })

  it('sends a whole window with the backend defaults left ABSENT', async () => {
    const { result } = renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          userIds: [],
          verifiedOnly: false,
          skip: 0,
          limit: 50,
          timezone: 'Europe/Kyiv',
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetFeed).toHaveBeenCalledTimes(1)
    expect(mockGetFeed).toHaveBeenCalledWith({
      project_id: 1,
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      skip: 0,
      limit: 50,
      timezone: 'Europe/Kyiv',
    })
    const params: Record<string, unknown> = { ...mockGetFeed.mock.calls[0][0] }
    expect('verified_only' in params).toBe(false)
    expect('user_ids' in params).toBe(false)
  })

  it('sends verified_only=true when the switch is on — a server-side filter', async () => {
    const { result } = renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          verifiedOnly: true,
          skip: 0,
          limit: 50,
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ verified_only: true }))
  })

  it('sends user_ids when operators are selected', async () => {
    const { result } = renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          userIds: [6274, 101],
          skip: 0,
          limit: 50,
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetFeed).toHaveBeenCalledWith(expect.objectContaining({ user_ids: [6274, 101] }))
  })

  it('falls back to the BROWSER zone for a profile without one — the zone always travels', async () => {
    const { result } = renderHook(
      () =>
        useRecordedPaymentsFeed({
          projectId: 1,
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          skip: 0,
          limit: 50,
          timezone: null,
        }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetFeed).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    )
  })
})
