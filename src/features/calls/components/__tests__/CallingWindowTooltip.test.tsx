/**
 * Explaining a call button disabled by the calling window (KAN-1107).
 *
 * The trap this component exists for: Button carries
 * `disabled:pointer-events-none`, so a plain `title` on a disabled button is
 * never shown — the browser fires no hover on it at all. The operator gets a
 * dead control and no reason.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  describe('pressing the disabled button', () => {
    // The button itself is disabled and, in the browser, pointer-events:none —
    // so the press lands on the wrapper. That is what these drive.
    function renderReporting(message: string | null) {
      const onBlockedAttempt = vi.fn()
      render(
        <CallingWindowTooltip message={message} onBlockedAttempt={onBlockedAttempt}>
          <Button disabled={Boolean(message)}>Call</Button>
        </CallingWindowTooltip>
      )
      return onBlockedAttempt
    }
    const wrapper = () => document.querySelector('[data-calling-window-blocked]') as HTMLElement

    it('reports a click', () => {
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      fireEvent.click(wrapper())
      expect(onBlockedAttempt).toHaveBeenCalledTimes(1)
    })

    it('reports Enter on key down, as a button does', () => {
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      fireEvent.keyDown(wrapper(), { key: 'Enter' })
      expect(onBlockedAttempt).toHaveBeenCalledTimes(1)
    })

    it('reports Space on key up, as a button does', () => {
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      fireEvent.keyDown(wrapper(), { key: ' ' })
      expect(onBlockedAttempt).not.toHaveBeenCalled()
      fireEvent.keyUp(wrapper(), { key: ' ' })
      expect(onBlockedAttempt).toHaveBeenCalledTimes(1)
    })

    it.each(['Enter', ' '])('ignores the auto-repeat of a held %j', (key) => {
      // A held key repeats about every 30ms. Each repeat is the same press,
      // and each one queued another toast and eventually another audit row.
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(wrapper(), { key, repeat: true })
      }
      expect(onBlockedAttempt).not.toHaveBeenCalled()
    })

    it('reports again on a genuine second press', () => {
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      fireEvent.keyDown(wrapper(), { key: 'Enter' })
      fireEvent.keyUp(wrapper(), { key: 'Enter' })
      fireEvent.keyDown(wrapper(), { key: 'Enter' })
      expect(onBlockedAttempt).toHaveBeenCalledTimes(2)
    })

    it('ignores other keys', () => {
      const onBlockedAttempt = renderReporting('Outside the allowed calling hours')
      fireEvent.keyDown(wrapper(), { key: 'Tab' })
      expect(onBlockedAttempt).not.toHaveBeenCalled()
    })

    it('takes the tab stop the disabled button gives up', () => {
      renderReporting('Outside the allowed calling hours')
      expect(wrapper()).toHaveAttribute('tabindex', '0')
    })

    it('leaves one button for assistive technology, not two', () => {
      // A role on the wrapper announced the control twice, one inside the
      // other. The disabled button is the one that should be heard.
      renderReporting('Outside the allowed calling hours')
      expect(screen.getAllByRole('button', { name: 'Call' })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled()
    })

    it('has nothing to report when calling is allowed', () => {
      renderReporting(null)
      expect(wrapper()).toBeNull()
    })
  })
})
