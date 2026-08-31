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

const pollRef: { current: (() => void) | null } = { current: null }

function renderBubble() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // A fresh element each time: re-rendering the identical element lets React
  // bail out, and the next poll's result would never be read.
  const ui = () => (
    <QueryClientProvider client={client}>
      <MinimizedCallBubble />
    </QueryClientProvider>
  )
  const result = render(ui())
  // Stands in for the next turn of the 2 s details poll.
  const poll = () => result.rerender(ui())
  pollRef.current = poll
  return { ...result, poll }
}

describe('MinimizedCallBubble', () => {
  beforeEach(() => {
    localStorage.clear()
    useCallStore.setState({ minimizedCall: null, openCallModal: null })
    useCallDetails.mockReset()
    useCallDetails.mockReturnValue({
      data: undefined,
      error: null,
      errorUpdatedAt: 0,
      dataUpdatedAt: 0,
    })
  })

  describe('a call the backend does not recognise', () => {
    it.each([404, 422])('clears the window after %i repeats', async (status) => {
      useCallStore.getState().setMinimizedCall(minimized())
      useCallStore.getState().setOpenCallModal('call-dialog')
      useCallDetails.mockReturnValue({
        data: undefined,
        error: notFound(status),
        errorUpdatedAt: 1,
        dataUpdatedAt: 0,
      })

      const { poll } = renderBubble()
      for (const at of [2, 3]) {
        useCallDetails.mockReturnValue({
          data: undefined,
          error: notFound(status),
          errorUpdatedAt: at,
          dataUpdatedAt: 0,
        })
        poll()
      }

      // Nothing will ever move this call to a terminal state, so the
      // auto-dismiss timer can never fire. Left alone, the bar suppresses every
      // incoming-call popup until the operator closes it by hand.
      await waitFor(() => {
        expect(useCallStore.getState().minimizedCall).toBeNull()
        expect(useCallStore.getState().openCallModal).toBeNull()
      })
    })

    it('keeps a ringing call through a single not-found blip', async () => {
      useCallStore.getState().setMinimizedCall(minimized({ callState: 'incoming' }))
      useCallDetails.mockReturnValue({
        data: undefined,
        error: notFound(404),
        errorUpdatedAt: 1,
        dataUpdatedAt: 0,
      })

      renderBubble()

      // This polls a ringing inbound call too. Dropping that window on one
      // stray 404 costs the operator the caller card and the hang-up control
      // while the phone is still ringing, with no way to get them back.
      await waitFor(() => expect(useCallDetails).toHaveBeenCalled())
      expect(useCallStore.getState().minimizedCall).not.toBeNull()
    })

    it('forgets the streak once the call is found again', async () => {
      useCallStore.getState().setMinimizedCall(minimized())
      useCallDetails.mockReturnValue({
        data: undefined,
        error: notFound(404),
        errorUpdatedAt: 1,
        dataUpdatedAt: 0,
      })
      const { poll } = renderBubble()

      useCallDetails.mockReturnValue({
        data: undefined,
        error: notFound(404),
        errorUpdatedAt: 2,
        dataUpdatedAt: 0,
      })
      poll()

      useCallDetails.mockReturnValue({
        data: { call_id: minimized().callId, state: 'RINGING' },
        error: null,
        errorUpdatedAt: 2,
        dataUpdatedAt: 3,
      })
      poll()

      useCallDetails.mockReturnValue({
        data: undefined,
        error: notFound(404),
        errorUpdatedAt: 4,
        dataUpdatedAt: 3,
      })
      poll()

      await waitFor(() => expect(useCallDetails).toHaveBeenCalled())
      expect(useCallStore.getState().minimizedCall).not.toBeNull()
    })

    it('discards a call the backend forgot even though it once answered', async () => {
      useCallStore.getState().setMinimizedCall(minimized())

      // TanStack keeps the last successful data when a later poll fails, so a
      // call that resolved once then started 404ing arrives here with BOTH set.
      // Treating retained data as a success would reset the streak on every
      // poll and leave the bar stuck forever.
      for (const at of [1, 2, 3]) {
        useCallDetails.mockReturnValue({
          data: { call_id: minimized().callId, state: 'RINGING' },
          error: notFound(404),
          errorUpdatedAt: at,
          dataUpdatedAt: 0,
        })
        if (at === 1) renderBubble()
        else pollRef.current?.()
      }

      await waitFor(() => expect(useCallStore.getState().minimizedCall).toBeNull())
    })

    it('keeps the window when the lookup fails for another reason', async () => {
      useCallStore.getState().setMinimizedCall(minimized())
      useCallDetails.mockReturnValue({ data: undefined, error: notFound(500), errorUpdatedAt: 1 })

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
        errorUpdatedAt: 0,
        dataUpdatedAt: 1,
      })

      renderBubble()

      await waitFor(() => expect(useCallDetails).toHaveBeenCalled())
      expect(useCallStore.getState().minimizedCall).not.toBeNull()
    })
  })
  describe('a call the socket reports over', () => {
    beforeEach(() => {
      // The socket beats the 2 s poll on nearly every call, so this path — not
      // the poll — is what an operator actually sees at the end of a call.
      useCallDetails.mockReturnValue({
        data: undefined,
        error: null,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
      })
    })

    it('shows the call as ended with its final duration', async () => {
      useCallStore.setState({
        minimizedCall: minimized({ callState: 'connected', elapsedTime: 5 }),
      })
      const { poll, getByText } = renderBubble()

      useCallStore
        .getState()
        .settleWindowForCall(minimized().callId!, { state: 'ended', totalDuration: 137 })
      poll()

      await waitFor(() => {
        expect(getByText('Call Ended')).toBeInTheDocument()
      })
      // 137 s, from the backend — not the locally ticked estimate.
      expect(getByText(/02:17/)).toBeInTheDocument()
    })

    it('clears itself once the operator has had a chance to see it', async () => {
      vi.useFakeTimers()
      try {
        useCallStore.setState({ minimizedCall: minimized({ callState: 'connected' }) })
        const { poll } = renderBubble()

        useCallStore
          .getState()
          .settleWindowForCall(minimized().callId!, { state: 'ended', totalDuration: 137 })
        poll()
        expect(useCallStore.getState().minimizedCall).not.toBeNull()

        await vi.advanceTimersByTimeAsync(3100)

        // The grace period is the point: deleting the window on the terminal
        // event skipped it, and the bar vanished mid-call-end.
        expect(useCallStore.getState().minimizedCall).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
