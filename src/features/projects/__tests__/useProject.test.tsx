/**
 * useProject Hook Tests
 *
 * TDD RED phase: Tests for single project query hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProject } from '../hooks/useProject'
import * as projectsApi from '../api/projectsApi'

vi.mock('../api/projectsApi')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch a single project successfully', async () => {
    const mockProject = {
      id: 1,
      name: 'Project Alpha',
      code: 'ALPHA',
      description: 'Test project',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    vi.mocked(projectsApi.projectsApi.getProject).mockResolvedValue(mockProject)

    const { result } = renderHook(() => useProject(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockProject)
    expect(projectsApi.projectsApi.getProject).toHaveBeenCalledWith(1)
  })

  it('should handle API errors', async () => {
    const error = new Error('Project not found')
    vi.mocked(projectsApi.projectsApi.getProject).mockRejectedValue(error)

    const { result } = renderHook(() => useProject(999), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })
})
