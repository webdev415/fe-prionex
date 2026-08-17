import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { MinimizedCallPill } from '../MinimizedCallPill'

function renderPill(over: Partial<Parameters<typeof MinimizedCallPill>[0]> = {}) {
  const onRestore = vi.fn()
  render(
    <MinimizedCallPill
      phoneNumber="+380971234567"
      clientName="Кондратюк Наталія"
      onRestore={onRestore}
      {...over}
    />
  )
  return { onRestore }
}

describe('MinimizedCallPill', () => {
  it('names the client so the operator knows which call it is', () => {
    renderPill()

    expect(screen.getByText('Кондратюк Наталія')).toBeVisible()
  })

  it('falls back to the number when no single client owns it', () => {
    renderPill({ clientName: null })

    // Better the number than nothing: the pill is the only thing on screen
    // identifying the call the operator is still on.
    expect(screen.getByText('+380971234567')).toBeVisible()
  })

  it('runs the clock once connected', () => {
    renderPill({ durationSeconds: 222 })

    expect(screen.getByText('03:42')).toBeVisible()
  })

  it('shows no clock while the call is only ringing', () => {
    renderPill()

    expect(screen.queryByText(/\d\d:\d\d/)).toBeNull()
  })

  it('offers a way back to the call', () => {
    const { onRestore } = renderPill()

    fireEvent.click(screen.getByRole('button'))

    // Without this the call is unreachable — minimising would lose it.
    expect(onRestore).toHaveBeenCalled()
  })
})
