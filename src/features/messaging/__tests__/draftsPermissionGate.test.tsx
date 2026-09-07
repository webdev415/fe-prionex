import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDrafts = vi.hoisted(() => vi.fn(async () => []))

vi.mock('../api/messagingApi', () => ({
  messagingApi: { listDrafts },
}))

const { useMessagingDrafts } = await import('../hooks/useMessaging')
const { useAuthStore } = await import('@/stores/authStore')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: { id: 1, username: 'u', permissions } as never,
  })
}

describe('the drafts query and the permission it needs', () => {
  beforeEach(() => {
    listDrafts.mockClear()
  })

  it('does not ask for drafts a reader may not have', async () => {
    signIn(['view_clients'])

    renderHook(() => useMessagingDrafts(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDrafts).not.toHaveBeenCalled()
  })

  it('asks for them when the reader may send on any channel', async () => {
    signIn(['send_message_sms'])

    renderHook(() => useMessagingDrafts(), { wrapper })

    await waitFor(() => expect(listDrafts).toHaveBeenCalledTimes(1))
  })

  it('managing drafts is not the same as reading them', async () => {
    signIn(['manage_drafts'])

    renderHook(() => useMessagingDrafts(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDrafts).not.toHaveBeenCalled()
  })

  it('a launch permission alone is enough', async () => {
    signIn(['launch_campaign_email'])

    renderHook(() => useMessagingDrafts(), { wrapper })

    await waitFor(() => expect(listDrafts).toHaveBeenCalledTimes(1))
  })
})
