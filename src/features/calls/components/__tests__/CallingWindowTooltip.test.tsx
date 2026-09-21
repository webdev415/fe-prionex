/**
 * Explaining a call button disabled by the calling window (KAN-1107).
 *
 * The trap this component exists for: Button carries
 * `disabled:pointer-events-none`, so a plain `title` on a disabled button is
 * never shown — the browser fires no hover on it at all. The operator gets a
 * dead control and no reason.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { CallingWindowTooltip } from '../CallingWindowTooltip'

function renderWith(message: string | null) {
  return render(
    <CallingWindowTooltip message={message}>
      <Button disabled={Boolean(message)} onClick={vi.fn()}>
        Call
      </Button>
    </CallingWindowTooltip>
  )
}

describe('CallingWindowTooltip', () => {
  it('adds no wrapper at all when calling is allowed', () => {
    const { container } = renderWith(null)
    // The common path should not pay for a provider or an extra element.
    expect(container.querySelector('span')).toBeNull()
    expect(screen.getByRole('button', { name: 'Call' })).toBeEnabled()
  })

  it('wraps the disabled button in an element that can still be hovered', () => {
    renderWith('Calls are not allowed today')
    const button = screen.getByRole('button', { name: 'Call' })
    expect(button).toBeDisabled()

    // The wrapper is the whole point: the button itself has
    // pointer-events:none while disabled, so the tooltip has to hang off a
    // parent that does not.
    const wrapper = button.closest('span')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.className).toContain('inline-block')
  })

  it('does not put the reason in a title on the disabled button', () => {
    // A title there is invisible, and an invisible explanation reads as no
    // explanation. Regression guard for the first version.
    renderWith('Calls are not allowed today')
    expect(screen.getByRole('button', { name: 'Call' })).not.toHaveAttribute('title')
  })
})
