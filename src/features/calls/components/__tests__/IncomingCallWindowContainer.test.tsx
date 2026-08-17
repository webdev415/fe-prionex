import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { IncomingCallWindowContainer } from '../IncomingCallWindowContainer'
import type { IncomingCallData } from '../../types'

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

vi.mock('@/features/clients/hooks/useNoteInteraction', () => ({
  useInteractionTypes: () => ({ data: [{ id: 1, code: 'incoming', name: 'Incoming' }] }),
  useInteractionContactTypes: () => ({ data: [] }),
  useInteractionResults: () => ({ data: [{ id: 4, name: 'Refusal' }] }),
  useCreateBulkInteraction: () => mutation(),
}))
vi.mock('../../hooks/useCall', () => ({
  useAnswerCall: () => mutation(),
  useHoldCall: () => mutation(),
  useRejectCall: () => mutation(),
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

function renderContainer(over: { answeredAt?: number | null; minimized?: boolean } = {}) {
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
      onDismiss={onDismiss}
    />
  )
  const result = render(ui(over.minimized ?? false))
  return { onDismiss, onMinimize, setMinimized: (m: boolean) => result.rerender(ui(m)) }
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

  it('shows no interaction form while the call is only ringing', () => {
    renderContainer({ answeredAt: null })

    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
