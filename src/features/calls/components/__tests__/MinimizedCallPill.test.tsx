import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { Button } from '@/components/ui/Button'
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
  it('is the same green as every other primary button', () => {
    renderPill()
    const restore = screen.getByRole('button')

    render(
      <Button variant="primary" size="icon-md" className="h-9 w-9">
        reference
      </Button>
    )
    const reference = screen.getByRole('button', { name: 'reference' })

    // Compared against the shared button rather than a hardcoded class, so
    // hand-rolling the colours back onto the pill fails here instead of
    // drifting quietly away from the design the next time the palette moves.
    expect(restore.className).toBe(reference.className)
  })

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
    renderPill({ answeredAt: Date.now() - 222_000 })

    expect(screen.getByText('03:42')).toBeVisible()
  })

  it('keeps the clock running while the operator works elsewhere', async () => {
    vi.useFakeTimers()
    try {
      renderPill({ answeredAt: Date.now() - 222_000 })

      await vi.advanceTimersByTimeAsync(3000)

      // The pill has to advance this itself. Nothing re-renders the header once
      // a second, so a duration handed down by its parent freezes the moment
      // the call is minimised and the operator watches a stopped clock for the
      // whole conversation.
      expect(screen.getByText('03:45')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
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
