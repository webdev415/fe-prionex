/**
 * KAN-973 §4 — the recent-call query is only worth making for operators who
 * have a shortcut bound.
 *
 * Its answer is used at exactly one moment: a hotkey press. Fetching it for
 * everyone put a request on the most-visited page in the app in service of a
 * feature most operators have not set up. This pins the gating so a later
 * refactor cannot quietly turn it back on for everyone.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const getClientCalls = vi.fn().mockResolvedValue({ calls: [], total: 0 })
vi.mock('@/features/clients/api/callSmsApi', () => ({
  callSmsApi: { getClientCalls: (id: number, p: unknown) => getClientCalls(id, p) },
}))

import { useClientRecentCalls } from '@/features/clients/hooks/useClients'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => getClientCalls.mockClear())

describe('useClientRecentCalls', () => {
  it('does not fetch when the operator has no shortcuts', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderHook(() => useClientRecentCalls(100, false), { wrapper: wrapper(client) })
    expect(getClientCalls).not.toHaveBeenCalled()
  })

  it('does not fetch without a real client', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderHook(() => useClientRecentCalls(0, true), { wrapper: wrapper(client) })
    expect(getClientCalls).not.toHaveBeenCalled()
  })

  it('asks for a small, newest-first page when it does fetch', () => {
    // The API orders by initiated_at DESC, so a short page still contains the
    // call that just ended — no need to pull the whole history.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderHook(() => useClientRecentCalls(100, true), { wrapper: wrapper(client) })
    expect(getClientCalls).toHaveBeenCalledWith(100, { limit: 20 })
  })
})
