import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/features/imports/api/contactTagAssignmentApi', () => ({
  contactTagAssignmentApi: {
    uploadContactTagAssignment: vi.fn(),
    executeContactTagAssignment: vi.fn(),
  },
}))

vi.mock('@/features/imports/api/importsApi', () => ({
  importsApi: {
    cancelImportJob: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}))

import {
  useContactTagAssignmentUpload,
  useContactTagAssignmentExecute,
} from '../useContactTagAssignment'
import { contactTagAssignmentApi } from '@/features/imports/api/contactTagAssignmentApi'
import { importsApi } from '@/features/imports/api/importsApi'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

const csv = () => new File(['tin,contact_value,category,tag'], 'tags.csv', { type: 'text/csv' })

describe('useContactTagAssignmentUpload', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes file, project and mode straight through', async () => {
    vi.mocked(contactTagAssignmentApi.uploadContactTagAssignment).mockResolvedValue({
      job_id: 7,
    } as never)

    const { result } = renderHook(() => useContactTagAssignmentUpload(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ file: csv(), projectId: 3, mode: 'remove' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(contactTagAssignmentApi.uploadContactTagAssignment).toHaveBeenCalledWith(
      expect.any(File),
      3,
      'remove'
    )
  })

  it('toasts on failure', async () => {
    vi.mocked(contactTagAssignmentApi.uploadContactTagAssignment).mockRejectedValue(
      new Error('boom')
    )

    const { result } = renderHook(() => useContactTagAssignmentUpload(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ file: csv(), projectId: 1, mode: 'assign' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('useContactTagAssignmentExecute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not cancel anything on success', async () => {
    vi.mocked(contactTagAssignmentApi.executeContactTagAssignment).mockResolvedValue({} as never)

    const { result } = renderHook(() => useContactTagAssignmentExecute(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ jobId: 11 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(importsApi.cancelImportJob).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalled()
  })

  it('cancels the orphaned job with onlyIfNotStarted after a failed execute', async () => {
    vi.mocked(contactTagAssignmentApi.executeContactTagAssignment).mockRejectedValue(
      new Error('gateway timeout')
    )

    const { result } = renderHook(() => useContactTagAssignmentExecute(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ jobId: 99 })

    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() => expect(importsApi.cancelImportJob).toHaveBeenCalled())

    // The flag is the whole point: this handler also fires for a job that
    // started fine, and an unconditional cancel aborts a live import at its next
    // batch boundary, leaving the file half-applied.
    expect(importsApi.cancelImportJob).toHaveBeenCalledWith(99, { onlyIfNotStarted: true })
    expect(toast.error).toHaveBeenCalled()
  })

  it('swallows a failing cancel instead of surfacing a second error', async () => {
    vi.mocked(contactTagAssignmentApi.executeContactTagAssignment).mockRejectedValue(
      new Error('execute failed')
    )
    vi.mocked(importsApi.cancelImportJob).mockRejectedValue(new Error('cancel failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useContactTagAssignmentExecute(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ jobId: 5 })

    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() => expect(consoleError).toHaveBeenCalled())

    // One toast, for the execute failure -- the cleanup failing is not a second
    // thing the operator can act on.
    expect(toast.error).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it('forwards the execute request body when one is given', async () => {
    vi.mocked(contactTagAssignmentApi.executeContactTagAssignment).mockResolvedValue({} as never)

    const { result } = renderHook(() => useContactTagAssignmentExecute(), {
      wrapper: createWrapper(),
    })
    result.current.mutate({ jobId: 3, request: { override_duplicates: true } as never })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(contactTagAssignmentApi.executeContactTagAssignment).toHaveBeenCalledWith(3, {
      override_duplicates: true,
    })
  })
})
