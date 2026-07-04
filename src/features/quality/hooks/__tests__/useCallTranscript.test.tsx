/**
 * useCallTranscript hook tests (Ф1).
 *
 * The interesting behaviour is error-shaping: 404 (not processed yet) and
 * 403 (no permission) must NOT retry and must map to `notReady` / `forbidden`
 * instead of a hard error — the panel renders friendly states for them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse } from 'axios'
import { useCallTranscript } from '../useCallTranscript'
import { getCallTranscript } from '../../api/transcriptService'

vi.mock('../../api/transcriptService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/transcriptService')>()
  return { ...original, getCallTranscript: vi.fn() }
})

const mockGetCallTranscript = vi.mocked(getCallTranscript)

function axiosErrorWithStatus(status: number): AxiosError {
  return new AxiosError('boom', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: {},
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse)
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const READY = {
  state: 'ready' as const,
  transcript: {
    language: 'uk',
    utterances: [{ i: 0, t0: 0.4, t1: 1.2, role: 'operator', text: 'Доброго дня.' }],
    scenes: [],
  },
  review: null,
}

describe('useCallTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the transcript when the brain has processed the call', async () => {
    mockGetCallTranscript.mockResolvedValue(READY)
    const { result } = renderHook(() => useCallTranscript('call-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.transcript).toBeDefined())
    expect(result.current.notReady).toBe(false)
    expect(result.current.forbidden).toBe(false)
    expect(result.current.review).toBeNull()
  })

  it('maps a 202/not_ready payload to notReady', async () => {
    mockGetCallTranscript.mockResolvedValue({ state: 'not_ready', status: 'pending' })
    const { result } = renderHook(() => useCallTranscript('call-2'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.notReady).toBe(true))
    expect(result.current.transcript).toBeUndefined()
    expect(result.current.isHardError).toBe(false)
  })

  it('maps 404 to notReady without retrying', async () => {
    mockGetCallTranscript.mockRejectedValue(axiosErrorWithStatus(404))
    const { result } = renderHook(() => useCallTranscript('call-3'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.notReady).toBe(true))
    expect(result.current.forbidden).toBe(false)
    expect(result.current.isHardError).toBe(false)
    expect(mockGetCallTranscript).toHaveBeenCalledTimes(1)
  })

  it('maps 403 to forbidden without retrying', async () => {
    mockGetCallTranscript.mockRejectedValue(axiosErrorWithStatus(403))
    const { result } = renderHook(() => useCallTranscript('call-4'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.forbidden).toBe(true))
    expect(result.current.notReady).toBe(false)
    expect(result.current.isHardError).toBe(false)
    expect(mockGetCallTranscript).toHaveBeenCalledTimes(1)
  })

  it('does not fetch while disabled or without callId', async () => {
    const { result } = renderHook(() => useCallTranscript(null), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')

    const { result: gated } = renderHook(() => useCallTranscript('call-5', false), {
      wrapper: createWrapper(),
    })
    expect(gated.current.fetchStatus).toBe('idle')
    expect(mockGetCallTranscript).not.toHaveBeenCalled()
  })
})
