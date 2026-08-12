import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallActions } from '../CallActions'

function renderActions(over: Partial<Parameters<typeof CallActions>[0]> = {}) {
  const props = {
    phase: 'ringing' as const,
    onAccept: vi.fn(),
    onCancel: vi.fn(),
    onHold: vi.fn(),
    onIgnoreInteraction: vi.fn(),
    ...over,
  }
  render(<CallActions {...props} />)
  return props
}

// Text queries are useless here: the i18n mock returns keys, not translations.
const buttons = () => screen.getAllByRole('button')

describe('CallActions', () => {
  it('offers Accept while ringing, never Hold', () => {
    renderActions({ phase: 'ringing' })

    // Two controls only: hang up, or take the call.
    expect(buttons()).toHaveLength(2)
  })

  it('offers Hold once connected, never Accept', () => {
    const props = renderActions({ phase: 'connected' })

    // Cancel, Hold, and the Ignore-interaction control.
    expect(buttons()).toHaveLength(3)
    fireEvent.click(buttons()[0])
    expect(props.onIgnoreInteraction).toHaveBeenCalled()
  })

  it('accepting the call reports it once', () => {
    const props = renderActions({ phase: 'ringing' })

    fireEvent.click(buttons()[1])

    expect(props.onAccept).toHaveBeenCalledTimes(1)
  })

  it('cannot accept twice while the request is in flight', () => {
    renderActions({ phase: 'ringing', acceptPending: true })

    // A second Accept would park the caller twice and strand the first leg.
    expect(buttons()[1]).toBeDisabled()
  })

  it('cannot hold twice while the request is in flight', () => {
    renderActions({ phase: 'connected', holdPending: true })

    expect(buttons()[2]).toBeDisabled()
  })

  it('drops the skip control once an interaction is filed', () => {
    renderActions({ phase: 'connected', interactionSettled: true })

    // Nothing left to skip; offering it would suggest the save can be undone.
    expect(buttons()).toHaveLength(2)
  })
})
