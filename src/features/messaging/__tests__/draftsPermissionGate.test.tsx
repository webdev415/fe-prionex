import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
const { DRAFT_PAGE_PERMISSIONS } = await import('@/constants/permissions')
const { PermissionRoute } = await import('@/routes/PermissionRoute')

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

function usePageTrash() {
  const canManageDrafts = useCanManageDrafts()
  return useDeletedMessagingDrafts(undefined, canManageDrafts)
}

describe('the trash and the permission it needs', () => {
  beforeEach(() => {
    listDeletedDrafts.mockClear()
  })

  it('is asked for by somebody who manages drafts', async () => {
    signIn(['manage_drafts', 'send_message_sms'])

    renderHook(() => usePageTrash(), { wrapper })

    await waitFor(() => expect(listDeletedDrafts).toHaveBeenCalledTimes(1))
  })

  it('is not asked for by somebody who may read but not manage', async () => {
    signIn(['send_message_sms'])

    renderHook(() => usePageTrash(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listDeletedDrafts).not.toHaveBeenCalled()
  })
})

describe('who may open the Message Drafts page', () => {
  function renderRoute() {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <PermissionRoute requiredPermissions={DRAFT_PAGE_PERMISSIONS} mode="any">
            <div>Message Drafts</div>
          </PermissionRoute>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }

  it('lets a manager in even though it may not read the list', () => {
    signIn(['manage_drafts'])

    renderRoute()

    expect(screen.getByText('Message Drafts')).toBeInTheDocument()
  })

  it('lets a sender in even though it may not manage', () => {
    signIn(['send_message_sms'])

    renderRoute()

    expect(screen.getByText('Message Drafts')).toBeInTheDocument()
  })

  it('keeps everybody else out', () => {
    signIn(['view_clients'])

    renderRoute()

    expect(screen.queryByText('Message Drafts')).toBeNull()
  })
})
