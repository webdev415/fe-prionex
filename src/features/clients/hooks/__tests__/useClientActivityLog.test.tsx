/**
 * The activity feed must not inherit the app-wide cache.
 *
 * `main.tsx` sets `staleTime` to five minutes for every query that does not
 * say otherwise, with `refetchOnWindowFocus` off. That suits a client's name
 * and address. It does not suit a feed of what people are doing to that client
 * right now: an operator could act, return to the tab, and be shown the answer
 * from before they acted, which reads as the feed having missed it.
 *
 * These tests run against a QueryClient carrying the real defaults, so they
 * fail if the hook stops overriding them.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useClientActivityLog } from '../useClientActivityLog'
import { activityLogApi, type ActivityLogResponse } from '@/features/clients/api/activityLogApi'

const getSpy = vi.spyOn(activityLogApi, 'get')

function response(): ActivityLogResponse {
  return { client_id: 2, entries: [], degraded: [], total: 0, page: 1, page_size: 50 }
}

/** The same defaults main.tsx installs, so the test sees what the app sees. */
function appLikeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 1000 * 60 * 5, retry: false, refetchOnWindowFocus: false },
    },
  })
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  getSpy.mockReset()
  getSpy.mockResolvedValue(response())
})

describe('useClientActivityLog', () => {
  it('asks again when the tab is reopened, rather than serving a five-minute-old answer', async () => {
    const client = appLikeClient()
    const filters = { page: 1 }

    const first = renderHook(() => useClientActivityLog(2, filters, true), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1))
    first.unmount()

    // Leaving and returning inside the default five minutes. Under the
    // inherited staleTime this second mount would serve the cached result and
    // send nothing -- the operator's own action missing from the feed.
    renderHook(() => useClientActivityLog(2, filters, true), { wrapper: wrapper(client) })

    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2))
  })

  it('still issues nothing for a tab that is not on screen', async () => {
    const client = appLikeClient()
    renderHook(() => useClientActivityLog(2, { page: 1 }, false), { wrapper: wrapper(client) })
    // Refetching on every visit only stays cheap while closed tabs stay silent.
    expect(getSpy).not.toHaveBeenCalled()
  })
})
