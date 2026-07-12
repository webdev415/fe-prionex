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
import {
  callQaSettingsKey,
  getCallQaSettings,
  updateCallQaSettings,
} from '../../api/callQaSettingsService'
import { transcriptKeys } from '../../api/transcriptService'

vi.mock('../../api/callQaSettingsService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/callQaSettingsService')>()
  return { ...original, getCallQaSettings: vi.fn(), updateCallQaSettings: vi.fn() }
})

let authState = { isAuthenticated: true }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}))

const mockGet = vi.mocked(getCallQaSettings)
const mockUpdate = vi.mocked(updateCallQaSettings)

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
    vi.clearAllMocks()
    authState = { isAuthenticated: true }
  })

  it('fetches the settings for an authenticated user', async () => {
    mockGet.mockResolvedValue({ transcripts_enabled: true })
    const { result } = renderHook(() => useCallQaSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => expect(result.current.data).toEqual({ transcripts_enabled: true }))
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('fires nothing while unauthenticated', () => {
    authState = { isAuthenticated: false }
    const { result } = renderHook(() => useCallQaSettings(), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('useUpdateCallQaSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState = { isAuthenticated: true }
  })

  it('PUTs the new value, seeds the settings cache and invalidates transcripts', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(callQaSettingsKey, { transcripts_enabled: true })
    queryClient.setQueryData(transcriptKeys.detail('c1'), { state: 'not_ready' })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    mockUpdate.mockResolvedValue({ transcripts_enabled: false })

    const { result } = renderHook(() => useUpdateCallQaSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await result.current.mutateAsync({ transcripts_enabled: false })

    expect(mockUpdate).toHaveBeenCalledWith({ transcripts_enabled: false })
    expect(queryClient.getQueryData(callQaSettingsKey)).toEqual({ transcripts_enabled: false })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transcriptKeys.all })
  })

  it('leaves the cache untouched when the PUT fails', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(callQaSettingsKey, { transcripts_enabled: true })
    mockUpdate.mockRejectedValue(new Error('403'))

    const { result } = renderHook(() => useUpdateCallQaSettings(), {
      wrapper: createWrapper(queryClient),
    })
    await expect(result.current.mutateAsync({ transcripts_enabled: false })).rejects.toThrow()

    expect(queryClient.getQueryData(callQaSettingsKey)).toEqual({ transcripts_enabled: true })
  })
})
