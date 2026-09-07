/**
 * Restoring has to put the draft back in the live list, not just out of trash.
 *
 * Both views are cached separately, so the restore mutation must invalidate the
 * whole `drafts` prefix. The trash key is nested under that prefix precisely so
 * this cannot be got wrong by adding a new key later.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

const toastFns = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: mockApi,
  default: mockApi,
}))
vi.mock('sonner', () => ({ toast: toastFns }))

const { messagingKeys } = await import('../useMessaging')
const { useRestoreMessagingDraft, useDeleteMessagingDraft } =
  await import('../useMessagingMutations')

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('draft trash cache keys', () => {
  it('nests the trash key under the drafts prefix', () => {
    const prefix = messagingKeys.drafts()
    const trash = messagingKeys.draftTrash({ channel: 'sms' })

    expect(trash.slice(0, prefix.length)).toEqual([...prefix])
  })

  it('separates trash pages by their params', () => {
    expect(messagingKeys.draftTrash({ offset: 0 })).not.toEqual(
      messagingKeys.draftTrash({ offset: 10 })
    )
  })
})

describe('useRestoreMessagingDraft', () => {
  let client: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockApi.post.mockResolvedValue({ data: { id: 5 } })
  })

  it('invalidates both the live list and the trash listing', async () => {
    const listKey = messagingKeys.draftList('sms')
    const trashKey = messagingKeys.draftTrash({ channel: 'sms' })
    client.setQueryData(listKey, [])
    client.setQueryData(trashKey, { total: 1, drafts: [{ id: 5 }] })

    const { result } = renderHook(() => useRestoreMessagingDraft(), {
      wrapper: wrapper(client),
    })
    result.current.mutate(5)

    await waitFor(() => expect(mockApi.post).toHaveBeenCalled())
    await waitFor(() => {
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
      expect(client.getQueryState(trashKey)?.isInvalidated).toBe(true)
    })
    // invalidateQueries runs first inside onSuccess, so the assertions above
    // hold even when the rest of that handler throws. Assert the handler ran to
    // completion, or this test goes green on a mutation that actually failed.
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(toastFns.success).toHaveBeenCalledTimes(1)
    expect(toastFns.error).not.toHaveBeenCalled()
  })

  it('leaves unrelated caches alone', async () => {
    const otherKey = messagingKeys.campaigns()
    client.setQueryData(otherKey, [])

    const { result } = renderHook(() => useRestoreMessagingDraft(), {
      wrapper: wrapper(client),
    })
    result.current.mutate(5)

    await waitFor(() => expect(mockApi.post).toHaveBeenCalled())
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false)
  })
})

describe('useDeleteMessagingDraft', () => {
  it('invalidates the trash listing too, so the deleted draft appears there', async () => {
    vi.clearAllMocks()
    mockApi.delete.mockResolvedValue({})
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const trashKey = messagingKeys.draftTrash()
    client.setQueryData(trashKey, { total: 0, drafts: [] })

    const { result } = renderHook(() => useDeleteMessagingDraft(), {
      wrapper: wrapper(client),
    })
    result.current.mutate(5)

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalled())
    await waitFor(() => expect(client.getQueryState(trashKey)?.isInvalidated).toBe(true))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toastFns.success).toHaveBeenCalledTimes(1)
    expect(toastFns.error).not.toHaveBeenCalled()
  })
})
