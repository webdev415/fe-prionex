import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAnswerCall, useHoldCall } from '../useCall'
import * as callService from '../../api/callService'

vi.mock('sonner')
vi.mock('../../api/callService')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const CALL = '72462e71-4419-48d9-8f65-5a534500e856'

describe('useAnswerCall', () => {
  beforeEach(() => vi.clearAllMocks())

  it('names the leg being answered, not just the call', async () => {
    vi.mocked(callService.callService.answerCall).mockResolvedValue({
      status: 'ok',
      message: '',
    })
    const { result } = renderHook(() => useAnswerCall(25, '2091'), { wrapper: createWrapper() })

    result.current.mutate(CALL)

    // A queue rings every member at once, so the backend cannot tell which
    // operator pressed Accept from the call id alone.
    await waitFor(() =>
      expect(callService.callService.answerCall).toHaveBeenCalledWith(CALL, '2091')
    )
  })

  it('tells the operator when answering fails', async () => {
    vi.mocked(callService.callService.answerCall).mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useAnswerCall(25, '2091'), { wrapper: createWrapper() })

    result.current.mutate(CALL)

    // Silence here would leave the operator staring at a ringing phone with no
    // idea the CRM had failed to pick it up.
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('says nothing on success — the call window is the feedback', async () => {
    vi.mocked(callService.callService.answerCall).mockResolvedValue({
      status: 'ok',
      message: '',
    })
    const { result } = renderHook(() => useAnswerCall(25, '2091'), { wrapper: createWrapper() })

    result.current.mutate(CALL)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('useHoldCall', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([true, false])('reports hold=%s so the same call can be resumed', async (hold) => {
    vi.mocked(callService.callService.holdCall).mockResolvedValue({ status: 'ok', message: '' })
    const { result } = renderHook(() => useHoldCall(25, '2091'), { wrapper: createWrapper() })

    result.current.mutate({ callId: CALL, hold })

    await waitFor(() =>
      expect(callService.callService.holdCall).toHaveBeenCalledWith(CALL, hold, '2091')
    )
  })

  it('tells the operator when holding fails', async () => {
    vi.mocked(callService.callService.holdCall).mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useHoldCall(25, '2091'), { wrapper: createWrapper() })

    result.current.mutate({ callId: CALL, hold: true })

    // Believing a caller is parked when they are not means talking over them.
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })
})
