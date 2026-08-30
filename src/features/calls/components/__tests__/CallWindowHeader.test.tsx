import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallWindowHeader } from '../CallWindowHeader'

function renderHeader(over: Partial<Parameters<typeof CallWindowHeader>[0]> = {}) {
  const onMinimize = vi.fn()
  render(
    <CallWindowHeader
      phoneNumber="+380971234567"
      clientName="Yeharmina Anastasia"
      onMinimize={onMinimize}
      {...over}
    />
  )
  return { onMinimize }
}

describe('CallWindowHeader', () => {
  it('shows no timer while the call is only ringing', () => {
    renderHeader()

    // There is nothing to count yet, and a 00:00 clock reads as a stalled call.
    expect(screen.queryByText(/\d\d:\d\d/)).toBeNull()
  })

  it('counts the conversation once connected', () => {
    renderHeader({ durationSeconds: 222 })

    expect(screen.getByText('03:42')).toBeInTheDocument()
  })

  it('starts the timer at zero rather than hiding it', () => {
    renderHeader({ durationSeconds: 0 })

    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('names an unmatched caller instead of leaving the line blank', () => {
    renderHeader({ clientName: null, unknown: true })

    expect(screen.getByText('+380971234567')).toBeInTheDocument()
    // Falls back to the unknown-contact label; the i18n mock returns the key.
    expect(screen.getByText(/unknownContact|Unknown contact/i)).toBeInTheDocument()
  })

  it('does not call a matched caller unknown just because no single client owns the number', () => {
    renderHeader({ clientName: null, unknown: false })

    // Several clients matched, so there is no one name to show — but the caller
    // is emphatically not unknown, and saying so misleads the operator.
    expect(screen.getByText('+380971234567')).toBeInTheDocument()
    expect(screen.queryByText(/unknownContact|Unknown contact/i)).toBeNull()
  })

  it('offers minimise and nothing that closes the window', () => {
    const { onMinimize } = renderHeader({ durationSeconds: 10 })

    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)

    fireEvent.click(controls[0])
    expect(onMinimize).toHaveBeenCalled()
  })
})
