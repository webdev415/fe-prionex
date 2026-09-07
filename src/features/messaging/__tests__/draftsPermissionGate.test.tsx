import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDrafts = vi.hoisted(() => vi.fn(async () => []))
const listDeletedDrafts = vi.hoisted(() => vi.fn(async () => ({ total: 0, drafts: [] })))

vi.mock('../api/messagingApi', () => ({
  messagingApi: { listDrafts, listDeletedDrafts },
}))

const { useMessagingDrafts, useDeletedMessagingDrafts, useCanManageDrafts } =
  await import('../hooks/useMessaging')
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

describe('the trash and the permission it needs', () => {
  beforeEach(() => {
    listDeletedDrafts.mockClear()
  })

  it('is asked for by somebody who both manages and may read', async () => {
    signIn(['manage_drafts', 'send_message_sms'])

    const { result } = renderHook(() => useCanManageDrafts(), { wrapper })
    expect(result.current).toBe(true)

    renderHook(() => useDeletedMessagingDrafts(undefined, true), { wrapper })
    await waitFor(() => expect(listDeletedDrafts).toHaveBeenCalledTimes(1))
  })

  it('is not asked for by somebody who manages but may not read', async () => {
    signIn(['manage_drafts'])

    renderHook(() => useDeletedMessagingDrafts(undefined, false), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDeletedDrafts).not.toHaveBeenCalled()
  })

  it('is not asked for by somebody who only sends', async () => {
    signIn(['send_message_sms'])

    const { result } = renderHook(() => useCanManageDrafts(), { wrapper })
    expect(result.current).toBe(false)

    renderHook(() => useDeletedMessagingDrafts(undefined, false), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDeletedDrafts).not.toHaveBeenCalled()
  })
})
