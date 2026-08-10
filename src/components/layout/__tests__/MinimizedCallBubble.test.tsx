import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'

import { MinimizedCallBubble } from '../MinimizedCallBubble'
import { useCallStore, type MinimizedCallInfo } from '@/stores/callStore'

const useCallDetails = vi.fn()

vi.mock('@/features/calls/hooks/useCall', () => ({
  useCallDetails: (...args: unknown[]) => useCallDetails(...args),
  useHangupCall: () => ({ mutate: vi.fn(), isPending: false }),
}))

function notFound(status: number) {
  return new AxiosError('not found', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  })
}

function minimized(over: Partial<MinimizedCallInfo> = {}): MinimizedCallInfo {
  return {
    id: 'bubble-1',
    type: 'call-dialog',
    clientName: 'Кондратюк Наталія',
    phoneNumber: '380973815116',
    callId: '22b7792e-94e7-4e04-8dab-4621cd815b4f',
    callState: 'incoming',
    timestamp: Date.now(),
    ...over,
  }
}

function renderBubble() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MinimizedCallBubble />
    </QueryClientProvider>
  )
}

describe('MinimizedCallBubble', () => {
  beforeEach(() => {
    localStorage.clear()
    useCallStore.setState({ minimizedCall: null, openCallModal: null })
    useCallDetails.mockReset()
    useCallDetails.mockReturnValue({ data: undefined, error: null })
  })

  describe('a call the backend does not recognise', () => {
    it.each([404, 422])('clears the window on %i', async (status) => {
      useCallStore.getState().setMinimizedCall(minimized())
      useCallStore.getState().setOpenCallModal('call-dialog')
      useCallDetails.mockReturnValue({ data: undefined, error: notFound(status) })

      renderBubble()

      // Nothing will ever move this call to a terminal state, so the
      // auto-dismiss timer can never fire. Left alone, the bar suppresses every
      // incoming-call popup until the operator closes it by hand.
      await waitFor(() => {
        expect(useCallStore.getState().minimizedCall).toBeNull()
        expect(useCallStore.getState().openCallModal).toBeNull()
      })
    })

    it('keeps the window when the lookup fails for another reason', async () => {
      useCallStore.getState().setMinimizedCall(minimized())
      useCallDetails.mockReturnValue({ data: undefined, error: notFound(500) })

      renderBubble()

      // A server fault says nothing about whether the call exists; throwing the
      // operator's live call window away over one would be far worse.
      await waitFor(() => expect(useCallDetails).toHaveBeenCalled())
      expect(useCallStore.getState().minimizedCall).not.toBeNull()
    })

    it('keeps the window while the call is still being reported', async () => {
      useCallStore.getState().setMinimizedCall(minimized({ callState: 'connected' }))
      useCallDetails.mockReturnValue({
        data: { call_id: minimized().callId, state: 'ACTIVE' },
        error: null,
      })

      renderBubble()

      await waitFor(() => expect(useCallDetails).toHaveBeenCalled())
      expect(useCallStore.getState().minimizedCall).not.toBeNull()
    })
  })
})
