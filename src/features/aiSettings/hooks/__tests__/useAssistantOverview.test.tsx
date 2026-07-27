/**
 * useAssistantOverview hook tests.
 *
 * The interesting behaviour: the GET is gated by BOTH auth and the
 * `manage_ai_settings` permission (unlike useAiAssistantSettings, which is
 * only auth-gated) — either missing piece must keep the query idle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAssistantOverview } from '../useAssistantOverview'
import { assistantOverviewTestMocks } from '@/test/mocks/assistantOverview'
import { useHasPermission } from '@/hooks'

const { mockGetAssistantOverview } = assistantOverviewTestMocks

const authState = { isAuthenticated: true }

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}))

const mockUseHasPermission = vi.mocked(useHasPermission)

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const OVERVIEW = {
  config: {
    model: '31b-thinking',
    commit: 'abc1234',
    flags: { thinking_mode_enabled: true },
    limits: { max_turns: 12 },
    manifest: { skills: ['draft_tools'] },
  },
  prompts: {
    persona: {
      name: 'Роша',
      role: 'assistant',
      tone: 'formal',
      language: 'ru',
      apply: 'gw-restart',
    },
    prompt0_append: { text: '', length: 0, limit: 2000, apply: 'hot-reload' },
    skills: [],
    knowledge: { apply: 'reseed', files: [] },
  },
}

describe('useAssistantOverview', () => {
  beforeEach(() => {
    mockGetAssistantOverview.mockReset()
    mockUseHasPermission.mockReset()
    authState.isAuthenticated = true
    mockUseHasPermission.mockReturnValue(true)
  })

  it('fetches the overview for an authenticated user with manage_ai_settings', async () => {
    mockGetAssistantOverview.mockResolvedValue(OVERVIEW)
    const { result } = renderHook(() => useAssistantOverview(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual(OVERVIEW))
    expect(mockGetAssistantOverview).toHaveBeenCalledTimes(1)
  })

  it('fires nothing while unauthenticated', () => {
    authState.isAuthenticated = false
    const { result } = renderHook(() => useAssistantOverview(), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetAssistantOverview).not.toHaveBeenCalled()
  })

  it('fires nothing without manage_ai_settings', () => {
    mockUseHasPermission.mockReturnValue(false)
    const { result } = renderHook(() => useAssistantOverview(), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetAssistantOverview).not.toHaveBeenCalled()
  })

  it('surfaces a query error on brain_unreachable (502) without retrying', async () => {
    mockGetAssistantOverview.mockRejectedValue(
      Object.assign(new Error('Bad Gateway'), {
        response: { status: 502, data: { detail: { code: 'brain_unreachable' } } },
      })
    )
    const { result } = renderHook(() => useAssistantOverview(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockGetAssistantOverview).toHaveBeenCalledTimes(1)
  })
})
