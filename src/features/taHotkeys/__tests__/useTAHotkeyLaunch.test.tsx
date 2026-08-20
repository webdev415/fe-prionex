/**
 * KAN-973 — the listener that turns a keypress into an open TA modal.
 *
 * The rules it consults are unit-tested next door. What was never covered is
 * the wiring, and that gap hid a real defect: with the executor modal open,
 * Radix traps focus inside it, `isTypingTarget` treats anything inside a
 * `role="dialog"` as typing, and the press was dropped before the single-modal
 * guard ran — so the toast the ticket asks for could never appear. A passing
 * unit test for that branch meant nothing, because the branch was unreachable.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const toastInfo = vi.fn()
let bindings: Record<string, number> = {}
let hasMinimized = false

vi.mock('../hooks/useTAHotkeys', () => ({
  useTAHotkeyBindings: () => bindings,
}))
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: (sel: (s: { minimized: unknown }) => unknown) =>
    sel({ minimized: hasMinimized ? { some: 'session' } : null }),
}))
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, d?: string) => d ?? k, i18n: { language: 'en' } }),
  }
})

import { useTAHotkeyLaunch } from '../useTAHotkeyLaunch'
import { TA_EXECUTOR_DIALOG_CLASS } from '../hotkey'

function Harness({
  enabled = true,
  isExecutorOpen = false,
  onLaunch,
}: {
  enabled?: boolean
  isExecutorOpen?: boolean
  onLaunch: (id: number) => void
}) {
  useTAHotkeyLaunch({ enabled, isExecutorOpen, onLaunch })
  return (
    <div>
      <input aria-label="notes" />
      {/* Some other dialog — still fully off-limits. */}
      <div role="dialog">
        <input aria-label="inside other modal" />
      </div>
      {/* The executor's own dialog, exempt from the typing rule. */}
      <div role="dialog" className={TA_EXECUTOR_DIALOG_CLASS} tabIndex={-1} data-testid="ta-dialog">
        <input aria-label="inside ta modal" />
      </div>
    </div>
  )
}

beforeEach(() => {
  toastInfo.mockClear()
  bindings = { 'Ctrl+1': 12 }
  hasMinimized = false
})

describe('useTAHotkeyLaunch', () => {
  it('launches the template bound to the combination', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).toHaveBeenCalledWith(12)
  })

  it('does nothing for a combination nobody assigned', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}9{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('ignores the combination while the operator is typing', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<Harness onLaunch={onLaunch} />)

    await user.click(getByLabelText('notes'))
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('ignores the combination inside somebody else’s dialog', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<Harness onLaunch={onLaunch} />)

    await user.click(getByLabelText('inside other modal'))
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('explains itself when focus is inside the executor dialog', async () => {
    // The realistic case, and the one that was broken: the modal is open, so
    // focus is trapped inside it. The operator presses their hotkey and must
    // be told why nothing opened.
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByTestId } = render(<Harness isExecutorOpen onLaunch={onLaunch} />)

    getByTestId('ta-dialog').focus()
    await user.keyboard('{Control>}1{/Control}')

    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledWith('Finish or close the open target action first')
  })

  it('leaves fields inside the executor dialog alone', async () => {
    // The exemption covers the dialog wrapper, not its inputs: a bare-key
    // binding must not fire while an amount is being typed into the modal.
    bindings = { A: 12 }
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<Harness isExecutorOpen onLaunch={onLaunch} />)

    await user.click(getByLabelText('inside ta modal'))
    await user.keyboard('a')

    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('explains itself when a session is minimized', async () => {
    hasMinimized = true
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(toastInfo).toHaveBeenCalledWith('Restore or finish the minimized target action first')
  })

  it('ignores the repeats of a held key', async () => {
    // Holding a bound combination fires keydown over and over. Only the first
    // press is an instruction; the rest would either stack "finish or close the
    // open target action first" toasts or, before the state settles, attempt a
    // second launch.
    const onLaunch = vi.fn()
    render(<Harness onLaunch={onLaunch} />)

    const held = { key: '1', ctrlKey: true, bubbles: true }
    document.dispatchEvent(new KeyboardEvent('keydown', held))
    document.dispatchEvent(new KeyboardEvent('keydown', { ...held, repeat: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { ...held, repeat: true }))

    expect(onLaunch).toHaveBeenCalledTimes(1)
  })

  // Round-2 review: the repeat guard used to be the handler's first statement,
  // so only the opening press of a held combination was prevented and every
  // repeat fell through to the browser — holding Ctrl+1 opened the modal once
  // and then switched tabs. The behavioural tests above could not see it: they
  // count launches and toasts, which the old order got right.
  it('prevents the browser default on the repeats of a held bound key', () => {
    render(<Harness onLaunch={vi.fn()} />)

    const held = { key: '1', ctrlKey: true, bubbles: true, cancelable: true }
    const first = new KeyboardEvent('keydown', held)
    const repeat = new KeyboardEvent('keydown', { ...held, repeat: true })
    document.dispatchEvent(first)
    document.dispatchEvent(repeat)

    expect(first.defaultPrevented).toBe(true)
    expect(repeat.defaultPrevented).toBe(true)
  })

  it('leaves an unbound key alone, repeat or not', () => {
    render(<Harness onLaunch={vi.fn()} />)

    const unbound = { key: '9', ctrlKey: true, bubbles: true, cancelable: true }
    const first = new KeyboardEvent('keydown', unbound)
    const repeat = new KeyboardEvent('keydown', { ...unbound, repeat: true })
    document.dispatchEvent(first)
    document.dispatchEvent(repeat)

    expect(first.defaultPrevented).toBe(false)
    expect(repeat.defaultPrevented).toBe(false)
  })

  it('does not toast repeatedly while a bound key is held with the modal open', async () => {
    const onLaunch = vi.fn()
    render(<Harness isExecutorOpen onLaunch={onLaunch} />)

    const held = { key: '1', ctrlKey: true, bubbles: true }
    document.dispatchEvent(new KeyboardEvent('keydown', held))
    document.dispatchEvent(new KeyboardEvent('keydown', { ...held, repeat: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { ...held, repeat: true }))

    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('does not listen at all when disabled', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness enabled={false} onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('sees state that changed after it was attached', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Harness onLaunch={onLaunch} />)

    bindings = { 'Ctrl+1': 99 }
    rerender(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).toHaveBeenCalledWith(99)
  })

  it('stops listening once the page unmounts', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { unmount } = render(<Harness onLaunch={onLaunch} />)

    unmount()
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })
})
