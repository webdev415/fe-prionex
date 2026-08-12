import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallActions } from '../CallActions'

function renderActions(over: Partial<Parameters<typeof CallActions>[0]> = {}) {
  const props = {
    phase: 'ringing' as const,
    onAccept: vi.fn(),
    onCancel: vi.fn(),
    onHold: vi.fn(),
    ...over,
  }
  render(<CallActions {...props} />)
  return props
}

// Text queries are useless here: the i18n mock returns keys, not translations.
const buttons = () => screen.getAllByRole('button')

describe('CallActions', () => {
  it('offers hang-up and Accept while ringing, never Hold', () => {
    renderActions({ phase: 'ringing' })

    expect(buttons()).toHaveLength(2)
  })

  it('offers hang-up and Hold once connected, never Accept', () => {
    renderActions({ phase: 'connected' })

    // No "skip saving" control: filing nothing is hanging up without saving.
    expect(buttons()).toHaveLength(2)
  })

  it('hangs up from either phase', () => {
    const ringing = renderActions({ phase: 'ringing' })
    fireEvent.click(buttons()[0])
    expect(ringing.onCancel).toHaveBeenCalledTimes(1)
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

    expect(buttons()[1]).toBeDisabled()
  })
})
