import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
const holdCall = mutation()

const saveInteraction = mutation()

vi.mock('@/features/clients/hooks/useNoteInteraction', () => ({
  useInteractionTypes: () => ({ data: [{ id: 1, code: 'incoming', name: 'Incoming' }] }),
  useInteractionContactTypes: () => ({ data: [] }),
  // Channels are subtypes, not types: Call / Messenger, never Incoming.
  useInteractionSubtypes: () => ({ data: [{ id: 9, name: 'Call' }] }),
  useInteractionResults: () => ({ data: [{ id: 4, name: 'Refusal' }] }),
  useCreateBulkInteraction: () => saveInteraction,
}))
vi.mock('../../hooks/useCall', () => ({
  useAnswerCall: () => mutation(),
  useHoldCall: () => holdCall,
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

  it('offers communication channels, not call directions', () => {
    renderContainer({ answeredAt: Date.now() })

    // The channel select used to be fed from interaction types, so the
    // operator picked "Incoming" as a communication channel.
    expect(screen.queryByText('Incoming')).toBeNull()
  })

  it('files the channel the operator chose', async () => {
    renderContainer({ answeredAt: Date.now() })

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'noted' } })
    // Result is the one field that gates saving.
    const [resultTrigger] = screen.getAllByRole('combobox')
    fireEvent.click(resultTrigger)
    fireEvent.click(await screen.findByText('Refusal'))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(saveInteraction.mutateAsync).toHaveBeenCalled())
    // subtype_id is what the backend derives the channel from. Omitted, every
    // interaction filed from this window landed with no channel at all.
    expect(saveInteraction.mutateAsync.mock.calls[0][0].subtypeId).toBe(9)
  })

  it('will not file an interaction against nobody when clients matched', async () => {
    renderContainer({ answeredAt: Date.now() })

    // Result first: it is the field that gates saving, so without choosing one
    // this asserts nothing about the client selection at all.
    const [resultTrigger] = screen.getAllByRole('combobox')
    fireEvent.click(resultTrigger)
    fireEvent.click(await screen.findByText('Refusal'))
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()

    // Every matched client toggled off is not the unknown-caller case. Filing
    // it would write the interaction to no card at all, and the operator would
    // still be told it was saved.
    screen.getAllByRole('switch').forEach((toggle) => fireEvent.click(toggle))

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('brings a parked caller back rather than parking them twice', () => {
    vi.stubEnv('VITE_CALL_ANSWER_ENABLED', 'true')
    renderContainer({ answeredAt: Date.now() })
    const holdButton = () => screen.getByRole('button', { name: /hold|resume/i })

    fireEvent.click(holdButton())
    expect(holdCall.mutate.mock.calls[0][0].hold).toBe(true)

    // The mutation only reports success back; the button flips on that.
    const [, options] = holdCall.mutate.mock.calls[0]
    act(() => options.onSuccess())

    fireEvent.click(holdButton())
    expect(holdCall.mutate.mock.calls[1][0].hold).toBe(false)
    vi.unstubAllEnvs()
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
      // onSettled, not onSuccess: a failed request must not strand the window.
      options.onSettled()
      expect(onDismiss).toHaveBeenCalled()
    })

    it('closes without posting a hangup for a call already over', () => {
      const { onDismiss } = renderContainer({ answeredAt: Date.now(), ended: true })

      fireEvent.click(screen.getByRole('button', { name: /close/i }))

      // Asterisk tore the channel down when the caller rang off. Posting a
      // hangup for it fails, and because dismissal hung off that request the
      // window could not be closed at all — while still holding the store
      // registration that blocks click-to-call.
      expect(hangupCall.mutate).not.toHaveBeenCalled()
      expect(rejectCall.mutate).not.toHaveBeenCalled()
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
