/**
 * useAiAssistantSettings hook tests.
 *
 * The interesting behaviour: the GET is auth-gated (login screen fires
 * nothing), and the PUT mutation must seed the settings cache with the
 * server response.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAiAssistantSettings, useUpdateAiAssistantSettings } from '../useAiAssistantSettings'
import { aiAssistantSettingsKey } from '../../api/aiAssistantSettingsService'
import { aiAssistantSettingsTestMocks } from '@/test/mocks/aiAssistantSettings'

const { mockGetAiAssistantSettings, mockUpdateAiAssistantSettings, aiAssistantSettingsAuthState } =
  aiAssistantSettingsTestMocks

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector(aiAssistantSettingsAuthState),
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('useAiAssistantSettings', () => {
  beforeEach(() => {
    mockGetAiAssistantSettings.mockReset()
    mockUpdateAiAssistantSettings.mockReset()
    aiAssistantSettingsAuthState.isAuthenticated = true
  })

  it('fetches the settings for an authenticated user', async () => {
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    const { result } = renderHook(() => useAiAssistantSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual({ assistant_enabled: true }))
    expect(mockGetAiAssistantSettings).toHaveBeenCalledTimes(1)
  })

  it('fires nothing while unauthenticated', () => {
    aiAssistantSettingsAuthState.isAuthenticated = false
    const { result } = renderHook(() => useAiAssistantSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetAiAssistantSettings).not.toHaveBeenCalled()
  })
})

describe('useUpdateAiAssistantSettings', () => {
  beforeEach(() => {
    mockGetAiAssistantSettings.mockReset()
    mockUpdateAiAssistantSettings.mockReset()
    aiAssistantSettingsAuthState.isAuthenticated = true
  })

  it('PUTs the new value and seeds the settings cache', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(aiAssistantSettingsKey, { assistant_enabled: true })
    mockUpdateAiAssistantSettings.mockResolvedValue({ assistant_enabled: false })

    const { result } = renderHook(() => useUpdateAiAssistantSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await result.current.mutateAsync({ assistant_enabled: false })

    expect(mockUpdateAiAssistantSettings).toHaveBeenCalledWith({ assistant_enabled: false })
    expect(queryClient.getQueryData(aiAssistantSettingsKey)).toEqual({
      assistant_enabled: false,
    })
  })

  it('leaves the cache untouched when the PUT fails', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(aiAssistantSettingsKey, { assistant_enabled: true })
    mockUpdateAiAssistantSettings.mockRejectedValue(new Error('403'))

    const { result } = renderHook(() => useUpdateAiAssistantSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await expect(result.current.mutateAsync({ assistant_enabled: false })).rejects.toThrow()

    expect(queryClient.getQueryData(aiAssistantSettingsKey)).toEqual({
      assistant_enabled: true,
    })
  })
})
