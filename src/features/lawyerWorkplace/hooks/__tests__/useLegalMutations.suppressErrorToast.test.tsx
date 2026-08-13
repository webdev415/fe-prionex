/**
 * The kanban mutations toast the raw API error by default. The deadline path
 * shows its own "Deadline was not saved" instead, so it asks these hooks to
 * stay quiet — without that the user gets two toasts for one failure (KAN-1000).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
const legalApiMock = vi.hoisted(() => ({ patchKanbanTask: vi.fn() }))
const taskApiMock = vi.hoisted(() => ({ updateTask: vi.fn() }))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('../../api/legalApi', () => ({ legalApi: legalApiMock }))
vi.mock('@/features/clients/api/taskApi', () => ({ taskApi: taskApiMock }))

const { usePatchLegalKanbanTaskMetadata, useUpdateLegalKanbanTask } =
  await import('../useLegalMutations')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('kanban mutation error toasts', () => {
  beforeEach(() => {
    toastMock.error.mockClear()
    legalApiMock.patchKanbanTask.mockReset().mockRejectedValue(new Error('boom'))
    taskApiMock.updateTask.mockReset().mockRejectedValue(new Error('boom'))
  })

  it('toasts the API error by default on a metadata patch', async () => {
    const { result } = renderHook(() => usePatchLegalKanbanTaskMetadata(), { wrapper })

    await expect(
      result.current.mutateAsync({ taskId: 1, payload: { due_date: null } })
    ).rejects.toThrow()

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
  })

  it('stays quiet on a metadata patch that owns its error message', async () => {
    const { result } = renderHook(() => usePatchLegalKanbanTaskMetadata(), { wrapper })

    await expect(
      result.current.mutateAsync({
        taskId: 1,
        payload: { due_date: null },
        suppressErrorToast: true,
      })
    ).rejects.toThrow()

    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('toasts the API error by default on a task update', async () => {
    const { result } = renderHook(() => useUpdateLegalKanbanTask(), { wrapper })

    await expect(result.current.mutateAsync({ taskId: 1, payload: {} })).rejects.toThrow()

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
  })

  it('stays quiet on a task update that owns its error message', async () => {
    const { result } = renderHook(() => useUpdateLegalKanbanTask(), { wrapper })

    await expect(
      result.current.mutateAsync({ taskId: 1, payload: {}, suppressErrorToast: true })
    ).rejects.toThrow()

    expect(toastMock.error).not.toHaveBeenCalled()
  })
})
