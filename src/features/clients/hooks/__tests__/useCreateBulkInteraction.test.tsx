import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useCreateBulkInteraction } from '../useNoteInteraction'
import * as interactionApi from '../../api/interactionApi'

vi.mock('sonner')
vi.mock('../../api/interactionApi')

let queryClient: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const CALL = '72462e71-4419-48d9-8f65-5a534500e856'

describe('useCreateBulkInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
  })

  it('sends every client in one request', async () => {
    vi.mocked(interactionApi.createInteractionsBulk).mockResolvedValue({ created: [] })
    const { result } = renderHook(() => useCreateBulkInteraction(), { wrapper })

    result.current.mutate({
      clientIds: [25, 26, 31],
      typeId: 2,
      resultId: 4,
      relatedCallUuid: CALL,
    })

    // One request, not three: a per-client loop would make "saved on two of
    // three" the normal failure, mid-call, with no way to tell which.
    await waitFor(() => expect(interactionApi.createInteractionsBulk).toHaveBeenCalledTimes(1))
    expect(interactionApi.createInteractionsBulk).toHaveBeenCalledWith(
      expect.objectContaining({ client_ids: [25, 26, 31], related_call_uuid: CALL })
    )
  })

  it('refreshes the history of every client that received it', async () => {
    vi.mocked(interactionApi.createInteractionsBulk).mockResolvedValue({ created: [] })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreateBulkInteraction(), { wrapper })

    result.current.mutate({ clientIds: [25, 26], typeId: 2 })

    // Each card carries its own row, so refreshing only one would leave the
    // other showing stale history.
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const invalidated = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(invalidated.some((k) => k?.includes('25'))).toBe(true)
    expect(invalidated.some((k) => k?.includes('26'))).toBe(true)
  })

  it('surfaces a failure rather than letting the operator assume it saved', async () => {
    vi.mocked(interactionApi.createInteractionsBulk).mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useCreateBulkInteraction(), { wrapper })

    result.current.mutate({ clientIds: [25], typeId: 2 })

    // There is no undo once an interaction is filed, so the success state must
    // never be shown on an unconfirmed write.
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isSuccess).toBe(false)
  })
})
