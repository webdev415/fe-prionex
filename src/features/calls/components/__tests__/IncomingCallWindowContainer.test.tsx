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

function renderContainer(over: { answeredAt?: number | null } = {}) {
  const onDismiss = vi.fn()
  render(
    <IncomingCallWindowContainer
      incomingCall={incomingCall}
      answeredAt={over.answeredAt ?? null}
      onAnswered={vi.fn()}
      agentExtension="2091"
      onDismiss={onDismiss}
    />
  )
  return { onDismiss }
}

// The i18n mock returns keys, so controls are found by their key fragments.
const minimize = () => screen.getByRole('button', { name: /minimize/i })
const restore = () => screen.getByRole('button', { name: /restore/i })

describe('IncomingCallWindowContainer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reduces the call to a pill rather than losing it', () => {
    renderContainer()

    fireEvent.click(minimize())

    // Without the pill a minimised call is unreachable: the operator is still
    // on it and has nothing on screen to return to.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(restore()).toBeVisible()
  })

  it('brings the operator back to the same call', () => {
    renderContainer({ answeredAt: Date.now() })

    fireEvent.click(minimize())
    fireEvent.click(restore())

    expect(screen.getByRole('textbox')).toBeVisible()
  })

  it('keeps what was already typed across a minimise', () => {
    renderContainer({ answeredAt: Date.now() })
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Promised to pay Friday' },
    })

    fireEvent.click(minimize())
    fireEvent.click(restore())

    // Rebuilding the window on restore would take the half-written interaction
    // with it, and the caller is still on the line.
    expect(screen.getByRole('textbox')).toHaveValue('Promised to pay Friday')
  })

  it('shows no interaction form while the call is only ringing', () => {
    renderContainer({ answeredAt: null })

    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
