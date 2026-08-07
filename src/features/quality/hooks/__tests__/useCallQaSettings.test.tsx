/**
 * useCallQaSettings hook tests.
 *
 * The interesting behaviour: the GET is auth-gated (login screen fires
 * nothing), and the PUT mutation must seed the settings cache with the
 * server response and invalidate cached transcript queries — they belong
 * to the previous switch state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallQaSettings, useUpdateCallQaSettings } from '../useCallQaSettings'
import { callQaSettingsKey } from '../../api/callQaSettingsService'
import { transcriptKeys } from '../../api/transcriptService'
import { callQaSettingsTestMocks } from '@/test/mocks/callQaSettings'

const { mockGetCallQaSettings, mockUpdateCallQaSettings, callQaAuthState } = callQaSettingsTestMocks

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector(callQaAuthState),
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('useCallQaSettings', () => {
  beforeEach(() => {
    mockGetCallQaSettings.mockReset()
    mockUpdateCallQaSettings.mockReset()
    callQaAuthState.isAuthenticated = true
  })

  it('fetches the settings for an authenticated user', async () => {
    mockGetCallQaSettings.mockResolvedValue({ transcripts_enabled: true })
    const { result } = renderHook(() => useCallQaSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual({ transcripts_enabled: true }))
    expect(mockGetCallQaSettings).toHaveBeenCalledTimes(1)
  })

  it('fires nothing while unauthenticated', () => {
    callQaAuthState.isAuthenticated = false
    const { result } = renderHook(() => useCallQaSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGetCallQaSettings).not.toHaveBeenCalled()
  })
})

describe('useUpdateCallQaSettings', () => {
  beforeEach(() => {
    mockGetCallQaSettings.mockReset()
    mockUpdateCallQaSettings.mockReset()
    callQaAuthState.isAuthenticated = true
  })

  it('PUTs the new value, seeds the settings cache and invalidates transcripts', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(callQaSettingsKey, { transcripts_enabled: true })
    queryClient.setQueryData(transcriptKeys.detail('c1'), { state: 'not_ready' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    mockUpdateCallQaSettings.mockResolvedValue({ transcripts_enabled: false })

    const { result } = renderHook(() => useUpdateCallQaSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await result.current.mutateAsync({ transcripts_enabled: false })

    expect(mockUpdateCallQaSettings).toHaveBeenCalledWith({ transcripts_enabled: false })
    expect(queryClient.getQueryData(callQaSettingsKey)).toEqual({ transcripts_enabled: false })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transcriptKeys.all })
  })

  it('leaves the cache untouched when the PUT fails', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(callQaSettingsKey, { transcripts_enabled: true })
    mockUpdateCallQaSettings.mockRejectedValue(new Error('403'))

    const { result } = renderHook(() => useUpdateCallQaSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await expect(result.current.mutateAsync({ transcripts_enabled: false })).rejects.toThrow()

    expect(queryClient.getQueryData(callQaSettingsKey)).toEqual({ transcripts_enabled: true })
  })
})
