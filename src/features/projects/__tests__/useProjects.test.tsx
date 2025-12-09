/**
 * useProjects Hook Tests
 *
 * TDD RED phase: Tests for projects query hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProjects } from '../hooks/useProjects'
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

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch projects successfully', async () => {
    const mockData = {
      projects: [
        {
          id: 1,
          name: 'Project Alpha',
          code: 'ALPHA',
          status: 'active' as const,
          is_active: true,
          total_clients: 0,
          total_debt_amount: 0,
          user_count: 0,
          role_count: 0,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Project Beta',
          code: 'BETA',
          status: 'active' as const,
          is_active: true,
          total_clients: 0,
          total_debt_amount: 0,
          user_count: 0,
          role_count: 0,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 2,
        total_pages: 1,
      },
    }

    vi.mocked(projectsApi.projectsApi.getProjects).mockResolvedValue(mockData)

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(projectsApi.projectsApi.getProjects).toHaveBeenCalledWith({})
  })

  it('should pass query params to API', async () => {
    const mockData = {
      projects: [
        {
          id: 1,
          name: 'Project Alpha',
          code: 'ALPHA',
          status: 'active' as const,
          is_active: true,
          total_clients: 0,
          total_debt_amount: 0,
          user_count: 0,
          role_count: 0,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      pagination: {
        page: 2,
        page_size: 10,
        total_items: 1,
        total_pages: 1,
      },
    }

    vi.mocked(projectsApi.projectsApi.getProjects).mockResolvedValue(mockData)

    const { result } = renderHook(() => useProjects({ page: 2, page_size: 10, search: 'alpha' }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(projectsApi.projectsApi.getProjects).toHaveBeenCalledWith({
      page: 2,
      page_size: 10,
      search: 'alpha',
    })
  })

  it('should handle API errors', async () => {
    const error = new Error('Failed to fetch projects')
    vi.mocked(projectsApi.projectsApi.getProjects).mockRejectedValue(error)

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })
})
