import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/features/imports/api/operatorAssignmentApi', () => ({
  operatorAssignmentApi: {
    uploadOperatorAssignment: vi.fn(),
    executeOperatorAssignment: vi.fn(),
    downloadOperatorAssignmentTemplate: vi.fn(),
  },
}))

import {
  useOperatorAssignmentUpload,
  useOperatorAssignmentExecute,
  useDownloadOATemplate,
} from '../useOperatorAssignment'
import { operatorAssignmentApi } from '@/features/imports/api/operatorAssignmentApi'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('useOperatorAssignmentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call uploadOperatorAssignment API on mutate', async () => {
    const mockPreview = {
      job_id: 1,
      batch_id: 'OA-batch-01',
      filename: 'test.csv',
      status: 'validated',
      total_records: 5,
      summary: { ready: 5, no_change: 0, invalid: 0, unique_operators: 2 },
      preview_rows: [],
      errors: [],
    }
    vi.mocked(operatorAssignmentApi.uploadOperatorAssignment).mockResolvedValue(mockPreview)

    const { result } = renderHook(() => useOperatorAssignmentUpload(), {
      wrapper: createWrapper(),
    })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    result.current.mutate({ file, projectId: 1 })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(operatorAssignmentApi.uploadOperatorAssignment).toHaveBeenCalledWith(file, 1)
    expect(result.current.data).toEqual(mockPreview)
  })

  it('should show error toast on failure', async () => {
    vi.mocked(operatorAssignmentApi.uploadOperatorAssignment).mockRejectedValue(
      new Error('File too large')
    )

    const { result } = renderHook(() => useOperatorAssignmentUpload(), {
      wrapper: createWrapper(),
    })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    result.current.mutate({ file, projectId: 1 })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(toast.error).toHaveBeenCalled()
  })
})

describe('useOperatorAssignmentExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call executeOperatorAssignment API on mutate', async () => {
    const mockResponse = { job_id: 1, status: 'processing', message: 'Queued' }
    vi.mocked(operatorAssignmentApi.executeOperatorAssignment).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useOperatorAssignmentExecute(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ jobId: 1, request: { assignment_reason: 'Test' } })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(operatorAssignmentApi.executeOperatorAssignment).toHaveBeenCalledWith(1, {
      assignment_reason: 'Test',
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it('should show error toast on failure', async () => {
    vi.mocked(operatorAssignmentApi.executeOperatorAssignment).mockRejectedValue(
      new Error('Validation expired')
    )

    const { result } = renderHook(() => useOperatorAssignmentExecute(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ jobId: 1 })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(toast.error).toHaveBeenCalled()
  })
})

describe('useDownloadOATemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate CSV template client-side and trigger download', async () => {
    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:http://localhost/mock-url'
    const createObjectURLSpy = vi.fn().mockReturnValue(mockUrl)
    const revokeObjectURLSpy = vi.fn()
    globalThis.URL.createObjectURL = createObjectURLSpy
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy

    // Mock document.createElement only for 'a' tags
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string, options?: ElementCreationOptions) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement
        return originalCreateElement(tag, options)
      })

    const originalAppendChild = document.body.appendChild.bind(document.body)
    const originalRemoveChild = document.body.removeChild.bind(document.body)
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if ((node as unknown) === mockAnchor) return node
      return originalAppendChild(node)
    })
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => {
      if ((node as unknown) === mockAnchor) return node
      return originalRemoveChild(node)
    })

    const { result } = renderHook(() => useDownloadOATemplate(), {
      wrapper: createWrapper(),
    })

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(mockAnchor.download).toBe('operator_assignment_template.csv')
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl)

    createElementSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
