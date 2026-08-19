import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { IncomingCallWindowContainer } from '../IncomingCallWindowContainer'
import type { IncomingCallData } from '../../types'
import { useCallStore } from '@/stores/callStore'

// Radix Select drives its trigger through pointer capture, which jsdom lacks.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })

// Shared instances so a test can see which endpoint the window used.
const rejectCall = mutation()
const hangupCall = mutation()

vi.mock('@/features/clients/hooks/useNoteInteraction', () => ({
  useInteractionTypes: () => ({ data: [{ id: 1, code: 'incoming', name: 'Incoming' }] }),
  useInteractionContactTypes: () => ({ data: [] }),
  useInteractionResults: () => ({ data: [{ id: 4, name: 'Refusal' }] }),
  useCreateBulkInteraction: () => mutation(),
}))
vi.mock('../../hooks/useCall', () => ({
  useAnswerCall: () => mutation(),
  useHoldCall: () => mutation(),
  useRejectCall: () => rejectCall,
  useHangupCall: () => hangupCall,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const incomingCall: IncomingCallData = {
  call_id: 'call-1',
  customer_phone: '+380971234567',
  agent_extension: '2091',
  client_id: 25,
  client_name: 'Кондратюк Наталія',
  loan_count: 0,
  total_debt: '0',
  loans: [],
}

function renderContainer(
  over: { answeredAt?: number | null; minimized?: boolean; ended?: boolean } = {}
) {
  const onDismiss = vi.fn()
  const onMinimize = vi.fn()
  const ui = (minimized: boolean) => (
    <IncomingCallWindowContainer
      incomingCall={incomingCall}
      answeredAt={over.answeredAt ?? null}
      onAnswered={vi.fn()}
      agentExtension="2091"
      minimized={minimized}
      onMinimize={onMinimize}
      ended={over.ended ?? false}
      onDismiss={onDismiss}
    />
  )
  const result = render(ui(over.minimized ?? false))
  return {
    onDismiss,
    onMinimize,
    unmount: result.unmount,
    setMinimized: (m: boolean) => result.rerender(ui(m)),
  }
}

// The i18n mock returns keys, so controls are found by their key fragments.
const minimize = () => screen.getByRole('button', { name: /minimize/i })

describe('IncomingCallWindowContainer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks to be minimised rather than deciding for itself', () => {
    const { onMinimize } = renderContainer()

    fireEvent.click(minimize())

    // The header owns the minimised bar, so it has to hear about this.
    expect(onMinimize).toHaveBeenCalled()
  })

  it('stands down while minimised', () => {
    renderContainer({ minimized: true, answeredAt: Date.now() })

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps what was already typed across a minimise', () => {
    const { setMinimized } = renderContainer({ answeredAt: Date.now() })
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Promised to pay Friday' },
    })

    setMinimized(true)
    setMinimized(false)

    // The form unmounts while minimised, so the draft has to live above it —
    // a comment written with the caller on the line cannot be recovered.
    expect(screen.getByRole('textbox')).toHaveValue('Promised to pay Friday')
  })

  it('counts as a call in progress while it is on screen', () => {
    useCallStore.setState({ minimizedCall: null, openCallModal: null })
    const { unmount } = renderContainer({ answeredAt: Date.now() })

    // Without this isCallActive() stays false for the whole inbound call, and
    // the "already in progress" guard lets the operator dial out mid-
    // conversation on the same extension.
    expect(useCallStore.getState().isCallActive()).toBe(true)

    unmount()
    expect(useCallStore.getState().openCallModal).toBeNull()
  })

  describe('ending the call', () => {
    const cancel = () => screen.getByRole('button', { name: /cancel|close/i })

    it('declines a ringing call and hangs up a connected one', () => {
      renderContainer({ answeredAt: null })
      fireEvent.click(cancel())

      // /reject records the call as declined by the operator and is gated on
      // receive_calls; using it on a finished conversation files it as a
      // refusal that never happened.
      expect(rejectCall.mutate).toHaveBeenCalled()
      expect(hangupCall.mutate).not.toHaveBeenCalled()

      vi.clearAllMocks()
      renderContainer({ answeredAt: Date.now() })
      fireEvent.click(cancel())

      expect(hangupCall.mutate).toHaveBeenCalled()
      expect(rejectCall.mutate).not.toHaveBeenCalled()
    })

    it('waits for the request before taking the window away', () => {
      const { onDismiss } = renderContainer({ answeredAt: null })

      fireEvent.click(cancel())

      // Dismissing first leaves the line up with no window to retry from, and
      // makes the pending state unreachable.
      expect(onDismiss).not.toHaveBeenCalled()
      const [, options] = rejectCall.mutate.mock.calls[0]
      options.onSuccess()
      expect(onDismiss).toHaveBeenCalled()
    })

    it('keeps the interaction form after the caller hangs up', () => {
      renderContainer({ answeredAt: Date.now(), ended: true })

      // The whole reason the window outlives the call: the form only exists
      // here, and there is no way back to a half-written interaction.
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('offers no way to hang up a call that is already over', () => {
      renderContainer({ answeredAt: Date.now(), ended: true })

      expect(screen.queryByRole('button', { name: /hold/i })).toBeNull()
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })
  })

  it('shows no interaction form while the call is only ringing', () => {
    renderContainer({ answeredAt: null })

    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
