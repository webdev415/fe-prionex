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
const { DRAFT_PAGE_PERMISSIONS, DRAFT_READ_PERMISSIONS, PERMISSIONS } =
  await import('@/constants/permissions')
const { useHasAnyPermission } = await import('@/hooks/usePermissions')

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

  it('is asked for by somebody who manages drafts', async () => {
    signIn(['manage_drafts', 'send_message_sms'])

    const { result } = renderHook(() => useCanManageDrafts(), { wrapper })
    expect(result.current).toBe(true)

    renderHook(() => useDeletedMessagingDrafts(undefined, true), { wrapper })
    await waitFor(() => expect(listDeletedDrafts).toHaveBeenCalledTimes(1))
  })

  it('is not asked for by somebody who may read but not manage', async () => {
    signIn(['send_message_sms'])

    const { result } = renderHook(() => useCanManageDrafts(), { wrapper })
    expect(result.current).toBe(false)

    renderHook(() => useDeletedMessagingDrafts(undefined, false), { wrapper })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDeletedDrafts).not.toHaveBeenCalled()
  })
})

describe('who may open the Message Drafts page', () => {
  it('lets a manager in even though it may not read the list', () => {
    signIn(['manage_drafts'])

    const { result } = renderHook(() => useHasAnyPermission(DRAFT_PAGE_PERMISSIONS), { wrapper })

    expect(result.current).toBe(true)
  })

  it('lets a sender in even though it may not manage', () => {
    signIn(['send_message_sms'])

    const { result } = renderHook(() => useHasAnyPermission(DRAFT_PAGE_PERMISSIONS), { wrapper })

    expect(result.current).toBe(true)
  })

  it('keeps everybody else out', () => {
    signIn(['view_clients'])

    const { result } = renderHook(() => useHasAnyPermission(DRAFT_PAGE_PERMISSIONS), { wrapper })

    expect(result.current).toBe(false)
  })

  it('opens the page on manage_drafts without widening what may be read', () => {
    expect(DRAFT_PAGE_PERMISSIONS).toEqual([
      PERMISSIONS.MESSAGING.MANAGE_DRAFTS,
      ...DRAFT_READ_PERMISSIONS,
    ])
    expect(DRAFT_READ_PERMISSIONS).not.toContain(PERMISSIONS.MESSAGING.MANAGE_DRAFTS)
  })
})
